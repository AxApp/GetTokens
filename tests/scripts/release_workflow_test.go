package main

import (
	"os"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestReleaseWorkflowBuildsSidecarAsIndependentMatrix(t *testing.T) {
	workflow := readReleaseWorkflow(t)
	jobs := requiredMapping(t, workflow, "jobs")

	sidecar := requiredMapping(t, jobs, "build-sidecar")
	if got := scalarValue(t, requiredValue(t, sidecar, "name")); got != "Build CLIProxyAPI sidecar" {
		t.Fatalf("build-sidecar name = %q, want %q", got, "Build CLIProxyAPI sidecar")
	}

	matrixInclude := requiredSequence(t,
		requiredMapping(t,
			requiredMapping(t, sidecar, "strategy"),
			"matrix",
		),
		"include",
	)
	assertMatrixTarget(t, matrixInclude, "darwin", "arm64")
	assertMatrixTarget(t, matrixInclude, "darwin", "amd64")

	uploadStep := findStepByUses(t, requiredSequence(t, sidecar, "steps"), "actions/upload-artifact@v6")
	with := requiredMapping(t, uploadStep, "with")
	if got := scalarValue(t, requiredValue(t, with, "name")); !strings.Contains(got, "cli-proxy-api-${{ matrix.goos }}-${{ matrix.goarch }}") {
		t.Fatalf("sidecar artifact name = %q, want matrix goos/goarch", got)
	}
	if got := scalarValue(t, requiredValue(t, with, "path")); !strings.Contains(got, "cli-proxy-api.meta.json") {
		t.Fatalf("sidecar artifact path = %q, want metadata included", got)
	}
}

func TestReleaseWorkflowBuildJobConsumesSidecarArtifact(t *testing.T) {
	workflow := readReleaseWorkflow(t)
	build := requiredMapping(t, requiredMapping(t, workflow, "jobs"), "build")

	needs := scalarOrSequenceValues(t, requiredValue(t, build, "needs"))
	assertContains(t, needs, "build-frontend")
	assertContains(t, needs, "build-sidecar")

	steps := requiredSequence(t, build, "steps")
	if step := findStepByName(t, steps, "Download CLIProxyAPI sidecar artifact"); step == nil {
		t.Fatal("build job missing sidecar artifact download step")
	}
	if step := findStepByName(t, steps, "Ensure CLIProxyAPI sidecar from source"); step != nil {
		t.Fatal("build job should consume sidecar artifacts instead of rebuilding from source")
	}

	reinstall := findStepByName(t, steps, "Reinstall sidecar into macOS app bundle")
	if reinstall == nil {
		t.Fatal("build job missing app bundle sidecar reinstall step")
	}
	run := scalarValue(t, requiredValue(t, reinstall, "run"))
	if !strings.Contains(run, "build/sidecar/cli-proxy-api") || !strings.Contains(run, "build/sidecar/cli-proxy-api.meta.json") {
		t.Fatalf("reinstall sidecar step should copy from downloaded artifact, got:\n%s", run)
	}
}

func TestReleaseWorkflowPublishesReleaseInParallelWithSparkle(t *testing.T) {
	workflow := readReleaseWorkflow(t)
	release := requiredMapping(t, requiredMapping(t, workflow, "jobs"), "release")

	needs := scalarOrSequenceValues(t, requiredValue(t, release, "needs"))
	if len(needs) != 1 || needs[0] != "build" {
		t.Fatalf("release needs = %#v, want only build so GitHub Release can publish in parallel with Sparkle appcast", needs)
	}

	condition := scalarValue(t, requiredValue(t, release, "if"))
	if strings.Contains(condition, "sparkle-appcast") {
		t.Fatalf("release condition should not wait on sparkle-appcast, got %q", condition)
	}
}

func TestReleaseWorkflowKeepsMacOSReleaseAssets(t *testing.T) {
	workflow := readReleaseWorkflow(t)
	release := requiredMapping(t, requiredMapping(t, workflow, "jobs"), "release")
	createRelease := findStepByName(t, requiredSequence(t, release, "steps"), "Create GitHub Release")
	if createRelease == nil {
		t.Fatal("release job missing Create GitHub Release step")
	}

	files := scalarValue(t, requiredValue(t, requiredMapping(t, createRelease, "with"), "files"))
	for _, name := range []string{
		"GetTokens_macOS_AppleSilicon.dmg",
		"GetTokens_macOS_AppleSilicon.tar.gz",
		"GetTokens_darwin_arm64.tar.gz",
		"GetTokens_macOS_Intel.dmg",
		"GetTokens_macOS_Intel.tar.gz",
		"GetTokens_darwin_amd64.tar.gz",
		"checksums.txt",
	} {
		if !strings.Contains(files, name) {
			t.Fatalf("release files missing %s in:\n%s", name, files)
		}
	}
}

func readReleaseWorkflow(t *testing.T) *yaml.Node {
	t.Helper()
	content, err := os.ReadFile(repoPath(t, ".github", "workflows", "release.yml"))
	if err != nil {
		t.Fatalf("read release workflow: %v", err)
	}

	var root yaml.Node
	if err := yaml.Unmarshal(content, &root); err != nil {
		t.Fatalf("parse release workflow: %v", err)
	}
	if len(root.Content) != 1 || root.Content[0].Kind != yaml.MappingNode {
		t.Fatalf("unexpected workflow root shape: kind=%v len=%d", root.Kind, len(root.Content))
	}
	return root.Content[0]
}

func requiredMapping(t *testing.T, node *yaml.Node, key string) *yaml.Node {
	t.Helper()
	value := requiredValue(t, node, key)
	if value.Kind != yaml.MappingNode {
		t.Fatalf("%s kind = %v, want mapping", key, value.Kind)
	}
	return value
}

func requiredSequence(t *testing.T, node *yaml.Node, key string) *yaml.Node {
	t.Helper()
	value := requiredValue(t, node, key)
	if value.Kind != yaml.SequenceNode {
		t.Fatalf("%s kind = %v, want sequence", key, value.Kind)
	}
	return value
}

func requiredValue(t *testing.T, node *yaml.Node, key string) *yaml.Node {
	t.Helper()
	if node.Kind != yaml.MappingNode {
		t.Fatalf("node kind = %v, want mapping while looking for %q", node.Kind, key)
	}
	for i := 0; i+1 < len(node.Content); i += 2 {
		if node.Content[i].Value == key {
			return node.Content[i+1]
		}
	}
	t.Fatalf("missing key %q", key)
	return nil
}

func scalarValue(t *testing.T, node *yaml.Node) string {
	t.Helper()
	if node.Kind != yaml.ScalarNode {
		t.Fatalf("node kind = %v, want scalar", node.Kind)
	}
	return node.Value
}

func scalarOrSequenceValues(t *testing.T, node *yaml.Node) []string {
	t.Helper()
	switch node.Kind {
	case yaml.ScalarNode:
		return []string{node.Value}
	case yaml.SequenceNode:
		values := make([]string, 0, len(node.Content))
		for _, item := range node.Content {
			values = append(values, scalarValue(t, item))
		}
		return values
	default:
		t.Fatalf("node kind = %v, want scalar or sequence", node.Kind)
		return nil
	}
}

func findStepByName(t *testing.T, steps *yaml.Node, name string) *yaml.Node {
	t.Helper()
	for _, step := range steps.Content {
		if step.Kind != yaml.MappingNode {
			continue
		}
		for i := 0; i+1 < len(step.Content); i += 2 {
			if step.Content[i].Value == "name" && step.Content[i+1].Value == name {
				return step
			}
		}
	}
	return nil
}

func findStepByUses(t *testing.T, steps *yaml.Node, uses string) *yaml.Node {
	t.Helper()
	for _, step := range steps.Content {
		if step.Kind != yaml.MappingNode {
			continue
		}
		for i := 0; i+1 < len(step.Content); i += 2 {
			if step.Content[i].Value == "uses" && step.Content[i+1].Value == uses {
				return step
			}
		}
	}
	t.Fatalf("missing step using %s", uses)
	return nil
}

func assertContains(t *testing.T, values []string, want string) {
	t.Helper()
	for _, value := range values {
		if value == want {
			return
		}
	}
	t.Fatalf("%#v does not contain %q", values, want)
}

func assertMatrixTarget(t *testing.T, include *yaml.Node, goos string, goarch string) {
	t.Helper()
	for _, item := range include.Content {
		if item.Kind != yaml.MappingNode {
			continue
		}
		if mappingScalar(item, "goos") == goos && mappingScalar(item, "goarch") == goarch {
			return
		}
	}
	t.Fatalf("missing sidecar matrix target %s/%s", goos, goarch)
}

func mappingScalar(node *yaml.Node, key string) string {
	if node.Kind != yaml.MappingNode {
		return ""
	}
	for i := 0; i+1 < len(node.Content); i += 2 {
		if node.Content[i].Value == key && node.Content[i+1].Kind == yaml.ScalarNode {
			return node.Content[i+1].Value
		}
	}
	return ""
}
