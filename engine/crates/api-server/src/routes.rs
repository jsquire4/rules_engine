use std::sync::Arc;

use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use cedar_policy::PolicySet;
use serde_json::json;

use crate::db;
use crate::AppState;

pub async fn check_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<engine::evaluator::CheckRequest>,
) -> Result<Json<engine::evaluator::CheckResponse>, (StatusCode, String)> {
    let policies = state.policies.read().await;
    let entities = state.entities.read().await;
    match engine::evaluator::check(&policies, &entities, &req) {
        Ok(response) => Ok(Json(response)),
        Err(e) => Err((StatusCode::UNPROCESSABLE_ENTITY, e.to_string())),
    }
}

pub async fn reload_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let sources = db::load_policy_sources(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let count = sources.len();
    let combined = sources.join("\n");
    let policy_set: PolicySet = combined
        .parse()
        .map_err(|e: cedar_policy::ParseErrors| {
            (StatusCode::UNPROCESSABLE_ENTITY, e.to_string())
        })?;

    // Reload entities (agent→group memberships and group hierarchy)
    let memberships = db::load_agent_memberships(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let groups = db::load_group_hierarchy(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let membership_tuples: Vec<(String, Vec<String>)> = memberships
        .into_iter()
        .map(|m| (m.agent_name, m.group_paths))
        .collect();
    let group_paths: Vec<String> = groups.into_iter().map(|g| g.path).collect();

    let entities = engine::evaluator::build_entities(&membership_tuples, &group_paths)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut policies_lock = state.policies.write().await;
    *policies_lock = policy_set;
    let mut entities_lock = state.entities.write().await;
    *entities_lock = entities;

    Ok(Json(json!({ "loaded": count })))
}

pub async fn health_handler() -> &'static str {
    "ok"
}
