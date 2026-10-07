from pathlib import Path


def test_publish_workflow_decrypts_before_publish_and_cleans_up():
    workflow = (Path(__file__).parents[1] / ".github/workflows/auto-post.yml").read_text()
    assert workflow.index("name: Decrypt posts into runner temporary directory") < workflow.index("name: Run publisher")
    assert "POSTS_ENCRYPTION_KEY: ${{ secrets.POSTS_ENCRYPTION_KEY }}" in workflow
    assert '"$RUNNER_TEMP/x-auto-poster/posts.json"' in workflow
    assert "POSTS_FILE_PATH=$RUNNER_TEMP/x-auto-poster/posts.json" in workflow
    assert "name: Remove temporary plaintext\n        if: always()" in workflow
    assert "git add data/state.json" in workflow
    assert "git add data/posts.json" not in workflow
    assert "pull_request" not in workflow
    assert "pull_request_target" not in workflow
    assert "cat data/posts.json" not in workflow
