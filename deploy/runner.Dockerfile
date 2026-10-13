FROM ubuntu:24.04
ARG RUNNER_VERSION=2.337.0
ARG RUNNER_SHA256=70920811a4f8ad4328818682bca5c6469c1c942fab52448868071d0063816613
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates git tar gzip sudo \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /runner
RUN curl -fsSL "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" -o /tmp/runner.tar.gz \
    && echo "${RUNNER_SHA256}  /tmp/runner.tar.gz" | sha256sum -c - \
    && tar -xzf /tmp/runner.tar.gz && rm /tmp/runner.tar.gz \
    && ./bin/installdependencies.sh \
    && chown -R 1000:1000 /runner
USER 1000:1000
ENV HOME=/home/ubuntu
CMD ["./run.sh"]
