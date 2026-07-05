"""Field-filter expression compiler used by `SignalRelayClient.get_job`."""

from typing import Callable


def compile_field_filter(expression: str) -> Callable[[dict], dict]:
    """Compile a caller-supplied filter expression into a callable.

    Real issue (dynamic-code-execution): `eval()` runs the caller-supplied
    expression string directly against the job dict as its evaluation
    namespace. There is no AST allowlist, no restricted builtins -- any
    Python expression the caller passes in executes with the interpreter's
    full builtins available.
    """

    def _apply(job: dict) -> dict:
        return eval(expression, {"__builtins__": __builtins__}, job)  # noqa: S307

    return _apply


def render_filter_docs_example() -> str:
    """Return the example snippet shown in the SDK's README.

    Decoy: the string below contains the literal substring "eval(" as
    documentation text describing what NOT to pass, not an executed call.
    A gate that regex-matches the raw token `eval(` anywhere in the file
    would double count this as a second finding; a structural/AST-aware
    gate correctly sees this as a string literal, not a call expression.
    """
    return "# Example: get_job(id, field_filter=\"eval('malicious')\")  <- do not do this"
