pub async fn load_policy_sources(pool: &sqlx::PgPool) -> Result<Vec<String>, sqlx::Error> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT pv.cedar_source FROM policy_versions pv JOIN policies p ON p.active_version_id = pv.id",
    )
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|(source,)| source).collect())
}

/// Agent with its group memberships (agent name → list of group paths)
#[derive(Debug)]
pub struct AgentMembership {
    pub agent_name: String,
    pub group_paths: Vec<String>,
}

/// Group with its parent path
#[derive(Debug)]
pub struct GroupHierarchy {
    pub path: String,
}

/// Load all agent→group memberships from the database
pub async fn load_agent_memberships(pool: &sqlx::PgPool) -> Result<Vec<AgentMembership>, sqlx::Error> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT a.name, g.path::text \
         FROM agents a \
         JOIN agent_group_memberships agm ON agm.agent_id = a.id \
         JOIN groups g ON g.id = agm.group_id \
         WHERE a.is_active = true \
         ORDER BY a.name, g.path"
    )
    .fetch_all(pool)
    .await?;

    // Group rows by agent name
    let mut map: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
    for (agent_name, group_path) in rows {
        map.entry(agent_name).or_default().push(group_path);
    }

    Ok(map.into_iter().map(|(agent_name, group_paths)| AgentMembership {
        agent_name,
        group_paths,
    }).collect())
}

/// Load all group paths for building the group hierarchy
pub async fn load_group_hierarchy(pool: &sqlx::PgPool) -> Result<Vec<GroupHierarchy>, sqlx::Error> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT path::text FROM groups ORDER BY path"
    )
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|(path,)| GroupHierarchy { path }).collect())
}
