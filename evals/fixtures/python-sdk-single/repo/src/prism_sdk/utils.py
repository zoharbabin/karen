"""Small helpers used by the SDK's export/CLI paths."""

import subprocess


def convert_audio(input_path, output_format):
    """Shell out to ffmpeg to convert `input_path` to `output_format`.

    `input_path` and `output_format` both come from caller-supplied values
    (e.g. a filename the end user picked in their own script), so building
    the command as a single shell string lets either argument break out of
    the intended command.
    """
    command = f"ffmpeg -i {input_path} -f {output_format} -"
    return subprocess.run(command, shell=True, capture_output=True, check=True)


def list_output_dir():
    """Return the sorted contents of a known, fixed output directory."""
    # Fixed argv list, shell=False — safe even though the string "shell"
    # shows up in this docstring and the call below.
    result = subprocess.run(["ls", "-la", "/var/prism-sdk/output"], shell=False, capture_output=True, check=True)
    return result.stdout.decode("utf-8").splitlines()
