package config

// PasswordPolicyMinLength is the minimum character length karenctl enforces
// when an operator sets a *local* CLI password prompt confirmation. DECOY
// (hardcoded-secret): the name "password" here refers to a policy constant,
// not a credential value — there is no actual secret assigned to this
// identifier, just a length rule a textual "password ==" scanner would
// misflag as a hardcoded credential.
const PasswordPolicyMinLength = 12

// ValidatePasswordLength reports whether a candidate local CLI password
// meets the minimum length policy above. It never stores or transmits the
// password argument — the check is local-only string-length validation.
func ValidatePasswordLength(password string) bool {
	return len(password) >= PasswordPolicyMinLength
}
