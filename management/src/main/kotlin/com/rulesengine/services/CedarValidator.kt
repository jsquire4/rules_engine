package com.rulesengine.services

import org.slf4j.LoggerFactory

object CedarValidator {
    private val log = LoggerFactory.getLogger(CedarValidator::class.java)
    private val nativeAvailable: Boolean

    init {
        nativeAvailable = try {
            // Triggers PolicySet.<clinit> which loads the native cedar_java_ffi library
            com.cedarpolicy.model.policy.PolicySet.parsePolicies("permit(principal, action, resource);")
            true
        } catch (e: UnsatisfiedLinkError) {
            log.warn("cedar-java native library not available — server-side Cedar validation disabled (client WASM validates instead)")
            false
        } catch (e: ExceptionInInitializerError) {
            // PolicySet static initializer wraps UnsatisfiedLinkError in this
            log.warn("cedar-java native library not available — server-side Cedar validation disabled (client WASM validates instead)")
            false
        } catch (e: NoClassDefFoundError) {
            log.warn("cedar-java classes not found — server-side Cedar validation disabled")
            false
        } catch (e: Exception) {
            log.warn("cedar-java init failed: ${e.message} — server-side validation disabled")
            false
        }
    }

    fun validate(cedarSource: String): ValidationResult {
        if (cedarSource.isBlank()) return ValidationResult(false, listOf("Cedar source is empty"))

        if (!nativeAvailable) {
            // Skip server-side validation; client WASM + Rust engine are authoritative
            return ValidationResult(true, emptyList())
        }

        return try {
            com.cedarpolicy.model.policy.PolicySet.parsePolicies(cedarSource)
            ValidationResult(true, emptyList())
        } catch (e: Exception) {
            val message = e.message ?: "Cedar parse error"
            ValidationResult(false, listOf(message))
        }
    }
}

data class ValidationResult(val valid: Boolean, val errors: List<String>)
