import json
import os
import pytest
from x_auto_poster.repositories.json_post_repository import JsonPostRepository


def row(post_id="a", **kwargs):
    return {"id":post_id, "scheduled_at":"2026-10-02T10:00:00", "content":"hello", "enabled":True, **kwargs}


def write_config(path, rows=None, **overrides):
    value={"timezone":"Asia/Shanghai", "max_lateness_minutes":90, "posts":rows or [], **overrides}
    path.write_text(json.dumps(value), encoding="utf-8")


def make_repo(tmp_path, rows=None, **overrides):
    posts_path=tmp_path/"posts.json"; write_config(posts_path, rows, **overrides)
    return JsonPostRepository(posts_path, tmp_path/"state.json")


def test_loads_posts_and_timezone(tmp_path):
    repo=make_repo(tmp_path,[row()])
    post=repo.list_posts()[0]
    assert post.id == "a" and post.scheduled_at.isoformat() == "2026-10-02T10:00:00+08:00"
    assert str(repo.get_config().timezone) == "Asia/Shanghai"


@pytest.mark.parametrize("posts,overrides,match", [
    ([row(),row()],{},"Duplicate"),
    ([row(content=" ")],{},"content"),
    ([row(scheduled_at="bad")],{},"scheduled_at"),
    ([row(scheduled_at="2026-10-02T10:00:00+08:00")],{},"timezone"),
    ([row(enabled=1)],{},"enabled"),
    ([{"id":"a","content":"hello","enabled":True}],{},"scheduled_at"),
    ([row(content=4)],{},"content"),
    ([row(id=" ")],{},"id"),
    ([],{"timezone":"Not/AZone"},"timezone"),
    ([],{"max_lateness_minutes":0},"max_lateness_minutes"),
    ([],{"posts":{}},"posts"),
])
def test_invalid_config_fails_as_a_whole(tmp_path, posts, overrides, match):
    with pytest.raises(ValueError, match=match): make_repo(tmp_path, posts, **overrides)


def test_missing_state_defaults_empty(tmp_path):
    repo=make_repo(tmp_path)
    assert repo.get_state() == {"posts":{}}


def test_state_is_saved_atomically(tmp_path, monkeypatch):
    repo=make_repo(tmp_path); called=[]; real_replace=os.replace
    monkeypatch.setattr("x_auto_poster.repositories.json_post_repository.os.replace",
                        lambda source,target: (called.append((source,target)),real_replace(source,target)))
    state={"posts":{"a":{"status":"submitted"}}}; repo.save_state(state)
    assert len(called)==1 and json.loads(repo.state_path.read_text())==state


def test_loads_many_posts_without_truncation(tmp_path):
    repo=make_repo(tmp_path,[row(str(i)) for i in range(5000)])
    assert len(repo.list_posts()) == 5000
