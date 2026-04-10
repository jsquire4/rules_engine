use std::sync::Arc;

use axum::Router;
use axum::routing::{get, post};
use cedar_policy::{Entities, PolicySet};
use sqlx::postgres::PgPool;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use tracing_subscriber::EnvFilter;

mod db;
mod routes;

pub struct AppState {
    pub pool: PgPool,
    pub policies: RwLock<PolicySet>,
    pub entities: RwLock<Entities>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    let pool = PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to database");

    // Retry policy + entity loading — Flyway migrations run from the management service,
    // so tables may not exist yet when the engine starts.
    let mut policy_set = PolicySet::new();
    let mut entities = Entities::empty();
    for attempt in 1..=30 {
        match db::load_policy_sources(&pool).await {
            Ok(sources) => {
                let combined = sources.join("\n");
                match combined.parse::<PolicySet>() {
                    Ok(ps) => {
                        policy_set = ps;
                        tracing::info!("Loaded {} Cedar policy source(s)", sources.len());

                        // Also load entities (agent→group memberships + group hierarchy)
                        match load_entities_from_db(&pool).await {
                            Ok(ents) => {
                                entities = ents;
                                tracing::info!("Loaded Cedar entity hierarchy");
                            }
                            Err(e) => {
                                tracing::warn!("Failed to load entities: {e} — using empty entity set");
                            }
                        }
                        break;
                    }
                    Err(e) => {
                        tracing::warn!("Failed to parse Cedar policies (attempt {attempt}/30): {e}");
                    }
                }
            }
            Err(e) => {
                tracing::warn!("Failed to load policies (attempt {attempt}/30): {e}");
            }
        }
        if attempt == 30 {
            tracing::warn!("Could not load policies after 30 attempts — starting with empty policy set (default deny)");
        } else {
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        }
    }

    let state = Arc::new(AppState {
        pool,
        policies: RwLock::new(policy_set),
        entities: RwLock::new(entities),
    });

    let app = Router::new()
        .route("/check", post(routes::check_handler))
        .route("/reload", post(routes::reload_handler))
        .route("/health", get(routes::health_handler))
        .with_state(state)
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001")
        .await
        .expect("Failed to bind to port 3001");

    tracing::info!("Cedar engine listening on 0.0.0.0:3001");
    axum::serve(listener, app).await.expect("Server error");
}

async fn load_entities_from_db(pool: &PgPool) -> Result<Entities, Box<dyn std::error::Error>> {
    let memberships = db::load_agent_memberships(pool).await?;
    let groups = db::load_group_hierarchy(pool).await?;

    let membership_tuples: Vec<(String, Vec<String>)> = memberships
        .into_iter()
        .map(|m| (m.agent_name, m.group_paths))
        .collect();
    let group_paths: Vec<String> = groups.into_iter().map(|g| g.path).collect();

    let entities = engine::evaluator::build_entities(&membership_tuples, &group_paths)?;
    Ok(entities)
}
