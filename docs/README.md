# Organization documentation

Start with the [agent instructions](../AGENTS.md). This index routes organization-wide guidance; it does not replace a repository's accepted decisions, adoption profiles, or required gates.

## Choose a task

| Task | Start here |
| --- | --- |
| Establish scope, ownership and engineering rules | [Engineering Quality Standard](engineering-quality-standard.md), [governance](../GOVERNANCE.md), [contribution rules](../CONTRIBUTING.md) |
| Plan the ecosystem or shared architecture | [Architecture index](architecture/README.md), [Foundation-first vision](architecture/ecosystem-vision.md), [evolution library delivery plan](architecture/evolution-library-delivery-plan.md), [evolution readiness](architecture/evolution-readiness.md) |
| Adopt modular architecture | [Feature Module Standard index](architecture/feature-module-standard/README.md), [repository admission](repository-admission.md) |
| Bootstrap or register a repository | [Repository admission](repository-admission.md), [registration](repository-registration.md) |
| Select runtimes, libraries or tooling | [Technology Stack Catalog](technology-stack.md), [backend stack](backend-stack.md), [backend stack versions](backend-stack-versions.md), [development tools](development-tools.md), [Node compatibility](node-runtime-compatibility.md), [native readiness plan](architecture/native-readiness-plan.md) |
| Verify CI, delivery or publication | [Engineering quality adoption](engineering-quality.md), [CI/CD practices](ci-cd-practices.md), [npm trusted publishing](npm-trusted-publishing.md), [security baseline](organization-security-baseline.md) |
| Inspect documentation or runtime admission policy | [Decision index](decisions/README.md), [current Docs mapping](governance/docs-gen3-current-policy-mapping.md), [quality source successor state](governance/quality-source-successor-current-state.md), [registry recovery](docs-b304-registry-recovery.md), [portable runtime authority](node26-portable-authority-r322.md) |

## Document organization

- [Architecture](architecture/): cross-repository design direction and versioned standards.
- [Decisions](decisions/): durable governance choices and their lifecycle.
- [Governance](governance/): current policy mapping and qualification state; machine-readable policy and retained evidence remain under the [root governance directory](../governance/).
- Root-level guides in this directory retain their established paths for consumers and deep links. Group new documents by responsibility and link the owning entry from this map.

A policy successor, design plan, or historical evidence does not automatically change a consumer's pinned contract. Follow the exact owning policy and repository profile rather than copying requirements into this index.
