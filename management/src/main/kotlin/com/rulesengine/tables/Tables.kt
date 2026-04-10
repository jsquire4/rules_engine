package com.rulesengine.tables

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.javatime.date
import org.jetbrains.exposed.sql.javatime.time
import org.jetbrains.exposed.sql.javatime.timestampWithTimeZone

object OrganizationsTable : Table("organizations") {
    val id = uuid("id")
    val name = text("name")
    val slug = text("slug")
    val createdAt = timestampWithTimeZone("created_at")

    override val primaryKey = PrimaryKey(id)
}

object GroupsTable : Table("groups") {
    val id = uuid("id")
    val orgId = uuid("org_id").references(OrganizationsTable.id)
    val name = text("name")
    val nodeType = text("node_type")
    val path = ltree("path")
    val parentId = uuid("parent_id").references(id).nullable()
    val createdAt = timestampWithTimeZone("created_at")

    override val primaryKey = PrimaryKey(id)
}

object AgentsTable : Table("agents") {
    val id = uuid("id")
    val orgId = uuid("org_id").references(OrganizationsTable.id)
    val name = text("name")
    val email = text("email").nullable()
    val domain = pgEnum("domain", "domain_enum", DomainEnum::fromDb, DomainEnum::dbValue)
    val isActive = bool("is_active")
    val createdAt = timestampWithTimeZone("created_at")

    override val primaryKey = PrimaryKey(id)
}

object AgentGroupMembershipsTable : Table("agent_group_memberships") {
    val agentId = uuid("agent_id").references(AgentsTable.id)
    val groupId = uuid("group_id").references(GroupsTable.id)

    override val primaryKey = PrimaryKey(agentId, groupId)
}

object ActionTypesTable : Table("action_types") {
    val id = uuid("id")
    val domain = pgEnum("domain", "domain_enum", DomainEnum::fromDb, DomainEnum::dbValue)
    val name = text("name")
    val description = text("description").nullable()

    override val primaryKey = PrimaryKey(id)
}

object DimensionDefinitionsTable : Table("dimension_definitions") {
    val id = uuid("id")
    val actionTypeId = uuid("action_type_id").references(ActionTypesTable.id)
    val dimensionName = text("dimension_name")
    val kind = pgEnum("kind", "dimension_kind", DimensionKind::fromDb, DimensionKind::dbValue)
    val numericMax = decimal("numeric_max", 19, 4).nullable()
    val rateWindow = text("rate_window").nullable()
    // PostgreSQL TEXT[] — Exposed lacks native array column support; stored/read as string representation
    val setMembers = text("set_members").nullable()
    val boolDefault = bool("bool_default").nullable()
    val temporalStart = time("temporal_start").nullable()
    val temporalEnd = time("temporal_end").nullable()
    val temporalExpiry = date("temporal_expiry").nullable()

    override val primaryKey = PrimaryKey(id)
}

object PoliciesTable : Table("policies") {
    val id = uuid("id")
    val orgId = uuid("org_id").references(OrganizationsTable.id)
    val name = text("name")
    val domain = pgEnum("domain", "domain_enum", DomainEnum::fromDb, DomainEnum::dbValue)
    val effect = pgEnum("effect", "policy_effect", PolicyEffect::fromDb, PolicyEffect::dbValue)
    val createdAt = timestampWithTimeZone("created_at")
    val activeVersionId = uuid("active_version_id").nullable()

    override val primaryKey = PrimaryKey(id)
}

object PolicyVersionsTable : Table("policy_versions") {
    val id = uuid("id")
    val policyId = uuid("policy_id").references(PoliciesTable.id)
    val versionNumber = integer("version_number")
    val constraints = jsonb("constraints") // JSONB column
    val cedarSource = text("cedar_source")
    // cedar_hash is GENERATED ALWAYS — read-only via raw SQL, excluded from Exposed inserts
    val cedarHash = text("cedar_hash").databaseGenerated()
    val createdAt = timestampWithTimeZone("created_at")
    val createdBy = uuid("created_by").nullable()

    override val primaryKey = PrimaryKey(id)
}

object PolicyAssignmentsTable : Table("policy_assignments") {
    val id = uuid("id")
    val policyId = uuid("policy_id").references(PoliciesTable.id)
    val policyVersionId = uuid("policy_version_id").references(PolicyVersionsTable.id)
    val groupId = uuid("group_id").references(GroupsTable.id).nullable()
    val agentId = uuid("agent_id").references(AgentsTable.id).nullable()
    val assignedAt = timestampWithTimeZone("assigned_at")

    override val primaryKey = PrimaryKey(id)
}

object DecisionLogTable : Table("decision_log") {
    val id = uuid("id")
    val evaluatedAt = timestampWithTimeZone("evaluated_at")
    val agentId = uuid("agent_id").references(AgentsTable.id)
    val actionTypeId = uuid("action_type_id").references(ActionTypesTable.id)
    val requestContext = jsonb("request_context") // JSONB column
    val bundleHash = text("bundle_hash")
    val outcome = pgEnum("outcome", "decision_outcome", DecisionOutcome::fromDb, DecisionOutcome::dbValue)
    val reason = text("reason").nullable()
    val matchedVersionId = uuid("matched_version_id").references(PolicyVersionsTable.id).nullable()

    override val primaryKey = PrimaryKey(id)
}
