"""Contract checks that keep the runtime version pins and their Renovate groups in step.

Renovate's "Python runtime" and "Node runtime" groups only open a pull request once every pin
in the group has an update (minimumGroupSize). If a pin is added, removed or hidden from
Renovate and the minimum is not changed to match, the grouped pull request is never created,
with no error. These tests fail instead.

They read repository files relative to the repository root, which does not exist inside
``mutants/``, so mutation testing ignores this module (see ``pyproject.toml``).
"""

import fnmatch
import json
import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
# Workflows that pin node-version for actions/setup-node; each pin is in the Node runtime group.
NODE_WORKFLOWS = ("tests.yml", "production-smoke-test.yml")


def _read(*parts: str) -> str:
    return REPO_ROOT.joinpath(*parts).read_text(encoding="utf-8")


def _renovate() -> dict:
    return json.loads(_read("renovate.json"))


def _renovate_group_minimum(group_name: str) -> int:
    """Return minimumGroupSize of the Renovate rule that sets ``group_name``."""
    sizes = [
        rule["minimumGroupSize"]
        for rule in _renovate()["packageRules"]
        if rule.get("groupName") == group_name
    ]
    assert sizes, f"No Renovate rule with groupName {group_name!r} found in renovate.json"
    return sizes[0]


def test_python_runtime_versions_are_aligned():
    """The Python version must be the same in every place the Python runtime group updates."""
    docker_version = re.search(
        r"^FROM python:(\d+\.\d+)-slim(?:@|\s|$)", _read("Dockerfile"), re.MULTILINE
    )
    devcontainer_version = re.search(
        r"^FROM mcr\.microsoft\.com/devcontainers/python:(\d+\.\d+)-bookworm(?:@|\s|$)",
        _read(".devcontainer", "Dockerfile"),
        re.MULTILINE,
    )
    pyright_version = re.search(
        r'^\s*"pythonVersion"\s*:\s*"(\d+\.\d+)"', _read("pyrightconfig.json"), re.MULTILINE
    )
    ruff_version = re.search(
        r'^target-version\s*=\s*"py(\d)(\d+)"$', _read(".linter-rules", ".ruff.toml"), re.MULTILINE
    )

    assert docker_version, "Python version not found in Dockerfile"
    assert devcontainer_version, "Python version not found in .devcontainer/Dockerfile"
    assert pyright_version, "Python version not found in pyrightconfig.json"
    assert ruff_version, "Ruff target-version not found in .linter-rules/.ruff.toml"

    versions = {
        "Dockerfile": docker_version.group(1),
        "Dev Container": devcontainer_version.group(1),
        "Pyright": pyright_version.group(1),
        "Ruff": f"{ruff_version.group(1)}.{ruff_version.group(2)}",
    }

    assert len(set(versions.values())) == 1, f"Python runtime versions are inconsistent: {versions}"
    assert _renovate_group_minimum("Python runtime") == len(versions)


def test_node_runtime_versions_are_aligned():
    """The Node major must be the same in the frontend image, CI workflows and the Dev Container."""
    frontend_dockerfile = _read("frontend", "Dockerfile")
    feature_options = re.search(
        r'"ghcr\.io/devcontainers/features/node:\d+"\s*:\s*\{([^}]*)\}',
        _read(".devcontainer", "devcontainer.json"),
    )
    feature_version = (
        re.search(r'"version"\s*:\s*"(\d+)"', feature_options.group(1)) if feature_options else None
    )
    workflow_versions = {
        workflow: re.findall(
            r"^\s*node-version:\s*(\d+)\s*$", _read(".github", "workflows", workflow), re.MULTILINE
        )
        for workflow in NODE_WORKFLOWS
    }

    # Each FROM line is a separate Renovate update, so each one counts towards the minimum.
    docker_versions = re.findall(
        r"^FROM node:(\d+)-alpine(?:@|\s)", frontend_dockerfile, re.MULTILINE
    )
    assert docker_versions, "Node version not found in frontend/Dockerfile"
    assert feature_version, "Node version not found in the Dev Container node feature"
    for workflow, found in workflow_versions.items():
        assert found, f"node-version not found in {workflow}"

    versions = {"Dev Container": feature_version.group(1)}
    for index, version in enumerate(docker_versions, start=1):
        versions[f"frontend/Dockerfile #{index}"] = version
    for workflow, found in workflow_versions.items():
        for index, version in enumerate(found, start=1):
            versions[f"{workflow} #{index}"] = version

    assert len(set(versions.values())) == 1, f"Node versions are inconsistent: {versions}"
    assert _renovate_group_minimum("Node runtime") == len(versions)


@pytest.mark.parametrize(
    "path",
    [
        "Dockerfile",
        "frontend/Dockerfile",
        ".devcontainer/devcontainer.json",
        ".devcontainer/Dockerfile",
        ".github/workflows/tests.yml",
        ".github/workflows/production-smoke-test.yml",
        ".linter-rules/.ruff.toml",
        "pyrightconfig.json",
    ],
)
def test_renovate_does_not_ignore_files_holding_runtime_pins(path):
    """A runtime pin in an ignored file is never updated, and the group never forms."""
    # Renovate ignores a file when the pattern is a substring of its path or a minimatch glob.
    # fnmatch is not minimatch (``*`` also crosses ``/`` here), but it agrees for the globs used
    # in ignorePaths, which is enough to catch ``.devcontainer/**`` or ``.devcontainer`` coming back.
    hiding = [
        glob for glob in _renovate()["ignorePaths"] if glob in path or fnmatch.fnmatch(path, glob)
    ]

    assert not hiding, (
        f"renovate.json ignorePaths {hiding} hides {path}, so Renovate cannot update it"
    )


def test_renovate_ruff_manager_finds_the_ruff_target_version():
    """The group minimum counts Ruff's pin, so Renovate's patterns must really match its file."""
    manager = next(
        m
        for m in _renovate()["customManagers"]
        if any("ruff" in p for p in m["managerFilePatterns"])
    )
    ruff = _read(".linter-rules", ".ruff.toml")

    # Renovate wraps file patterns in slashes and uses JavaScript named groups (?<name>...).
    file_pattern = manager["managerFilePatterns"][0]
    assert file_pattern.startswith("/")
    assert file_pattern.endswith("/")
    assert re.search(file_pattern[1:-1], ".linter-rules/.ruff.toml")

    pattern = re.sub(r"\(\?<(?![=!])", "(?P<", manager["matchStrings"][0])
    found = re.search(pattern, ruff)
    assert found, "Renovate's matchStrings do not match target-version in .ruff.toml"
    assert re.search(
        rf'^target-version\s*=\s*"py{found.group("major")}{found.group("minor")}"',
        ruff,
        re.MULTILINE,
    )


def test_renovate_pyright_manager_finds_the_pyright_python_version():
    """The group minimum counts Pyright's pin, so Renovate's patterns must really match its file."""
    manager = next(
        m
        for m in _renovate()["customManagers"]
        if any("pyrightconfig" in p for p in m["managerFilePatterns"])
    )

    file_pattern = manager["managerFilePatterns"][0]
    assert re.search(file_pattern[1:-1], "pyrightconfig.json")

    pattern = re.sub(r"\(\?<(?![=!])", "(?P<", manager["matchStrings"][0])
    found = re.search(pattern, _read("pyrightconfig.json"))
    assert found, "Renovate's matchStrings do not match pythonVersion in pyrightconfig.json"


def test_python_runtime_group_has_no_release_age_after_catch_all_rule():
    """Later rules win, so the group's release age must not be overridden by a later rule."""
    rules = _renovate()["packageRules"]
    group = next(i for i, r in enumerate(rules) if r.get("groupName") == "Python runtime")
    catch_all = next(i for i, r in enumerate(rules) if r.get("matchPackageNames") == ["*"])

    assert rules[group]["minimumReleaseAge"] is None
    assert group > catch_all

    python_names = set(rules[group]["matchPackageNames"])
    python_managers = {"dockerfile", "devcontainer", "custom.regex"}
    for later in rules[group + 1 :]:
        if "minimumReleaseAge" not in later:
            continue
        names = set(later.get("matchPackageNames", []))
        managers = set(later.get("matchManagers", []))
        scoped_away = (names and names.isdisjoint(python_names | {"*"})) or (
            managers and managers.isdisjoint(python_managers)
        )
        assert scoped_away, f"Rule after the Python group could set its release age: {later}"
