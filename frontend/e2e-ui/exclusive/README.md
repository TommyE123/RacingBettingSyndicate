# Exclusive UI E2E tests

Specs here change state that other tests can see, so the `exclusive` project runs them one at a
time (`workers: 1`) after the `parallel` project has finished. Nothing needs that yet: every
current test creates its own users and competition, so it lives in `../parallel/`.
