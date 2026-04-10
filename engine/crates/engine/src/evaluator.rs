use cedar_policy::{
    Authorizer, Context, Entities, Entity, EntityUid, PolicySet, Request, RestrictedExpression,
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use thiserror::Error;

#[derive(Debug, Deserialize)]
pub struct CheckRequest {
    pub principal: String,
    pub action: String,
    pub resource: String,
    pub context: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct CheckResponse {
    pub decision: String,
    pub diagnostics: Vec<String>,
}

#[derive(Debug, Error)]
pub enum EvalError {
    #[error("parse error: {0}")]
    ParseError(String),
    #[error("request error: {0}")]
    RequestError(String),
    #[error("context error: {0}")]
    ContextError(String),
    #[error("entities error: {0}")]
    EntitiesError(String),
}

pub fn check(
    policy_set: &PolicySet,
    entities: &Entities,
    request: &CheckRequest,
) -> Result<CheckResponse, EvalError> {
    let principal: EntityUid = request
        .principal
        .parse()
        .map_err(|e: cedar_policy::ParseErrors| EvalError::ParseError(format!("principal: {e}")))?;

    let action: EntityUid = request
        .action
        .parse()
        .map_err(|e: cedar_policy::ParseErrors| EvalError::ParseError(format!("action: {e}")))?;

    let resource: EntityUid = request
        .resource
        .parse()
        .map_err(|e: cedar_policy::ParseErrors| EvalError::ParseError(format!("resource: {e}")))?;

    let context = if request.context.is_null() || request.context == serde_json::json!({}) {
        Context::empty()
    } else {
        Context::from_json_value(request.context.clone(), None)
            .map_err(|e| EvalError::ContextError(e.to_string()))?
    };

    let cedar_request = Request::new(principal, action, resource, context, None)
        .map_err(|e| EvalError::RequestError(e.to_string()))?;

    let authorizer = Authorizer::new();
    let response = authorizer.is_authorized(&cedar_request, policy_set, entities);

    let decision = match response.decision() {
        cedar_policy::Decision::Allow => "Allow".to_string(),
        cedar_policy::Decision::Deny => "Deny".to_string(),
    };

    let mut diagnostics: Vec<String> = response
        .diagnostics()
        .reason()
        .map(|id| id.to_string())
        .collect();

    for err in response.diagnostics().errors() {
        diagnostics.push(format!("error: {err}"));
    }

    Ok(CheckResponse {
        decision,
        diagnostics,
    })
}

/// Build Cedar Entities from agent memberships and group hierarchy.
///
/// Creates:
/// - A Group entity for each group path, with parent = its ltree parent (e.g. "acme.finance" parent is "acme")
/// - An Agent entity for each agent, with parents = all groups it belongs to
/// - A default Resource::"any" and Resource::"default" entity
pub fn build_entities(
    agent_memberships: &[(String, Vec<String>)],   // (agent_name, [group_paths])
    group_paths: &[String],                         // all group paths
) -> Result<Entities, EvalError> {
    let mut entity_vec: Vec<Entity> = Vec::new();
    let empty_attrs: HashMap<String, RestrictedExpression> = HashMap::new();

    // Build Group entities with hierarchy derived from ltree paths.
    // E.g. "acme.finance.ap" has parent "acme.finance", which has parent "acme".
    let group_set: HashSet<&str> = group_paths.iter().map(|s| s.as_str()).collect();

    for path in group_paths {
        let uid: EntityUid = format!("Group::\"{}\"", path)
            .parse()
            .map_err(|e: cedar_policy::ParseErrors| EvalError::EntitiesError(format!("group uid: {e}")))?;

        let mut parents: HashSet<EntityUid> = HashSet::new();
        if let Some(dot_pos) = path.rfind('.') {
            let parent_path = &path[..dot_pos];
            if group_set.contains(parent_path) {
                let parent_uid: EntityUid = format!("Group::\"{}\"", parent_path)
                    .parse()
                    .map_err(|e: cedar_policy::ParseErrors| EvalError::EntitiesError(format!("group parent uid: {e}")))?;
                parents.insert(parent_uid);
            }
        }

        let entity = Entity::new(uid, empty_attrs.clone(), parents)
            .map_err(|e| EvalError::EntitiesError(format!("group entity: {e}")))?;
        entity_vec.push(entity);
    }

    // Build Agent entities with their group memberships as parents
    for (agent_name, groups) in agent_memberships {
        let uid: EntityUid = format!("Agent::\"{}\"", agent_name)
            .parse()
            .map_err(|e: cedar_policy::ParseErrors| EvalError::EntitiesError(format!("agent uid: {e}")))?;

        let mut parents: HashSet<EntityUid> = HashSet::new();
        for group_path in groups {
            let parent_uid: EntityUid = format!("Group::\"{}\"", group_path)
                .parse()
                .map_err(|e: cedar_policy::ParseErrors| EvalError::EntitiesError(format!("agent parent uid: {e}")))?;
            parents.insert(parent_uid);
        }

        let entity = Entity::new(uid, empty_attrs.clone(), parents)
            .map_err(|e| EvalError::EntitiesError(format!("agent entity: {e}")))?;
        entity_vec.push(entity);
    }

    // Add default Resource entities
    for res_name in &["any", "default"] {
        let uid: EntityUid = format!("Resource::\"{}\"", res_name)
            .parse()
            .map_err(|e: cedar_policy::ParseErrors| EvalError::EntitiesError(format!("resource uid: {e}")))?;
        let entity = Entity::new(uid, empty_attrs.clone(), HashSet::new())
            .map_err(|e| EvalError::EntitiesError(format!("resource entity: {e}")))?;
        entity_vec.push(entity);
    }

    Entities::from_entities(entity_vec, None)
        .map_err(|e| EvalError::EntitiesError(format!("entities: {e}")))
}
