# Backend stack reference

Owner direction recorded on 2026-10-22. This is the maintained reference for
backend technology responsibilities shared by Agent Teams service applications.
It is separate from the [development toolchain catalog](development-tools.md)
and from frontend, mobile UI and desktop-shell choices.

## Scope and adoption

This document is the central source for this reference stack. A consuming
repository adopts an applicable subset through its existing owner decision and
adoption record, linking this file at an exact reviewed central commit. Keep
product-specific responsibilities, exceptions and qualification evidence in that
repository; link the central choices instead of copying the table below.

Membership in the organization does not install or adopt the stack. Libraries,
tooling packages and workers use only the capabilities they need. Existing
accepted ADRs, published contracts and Feature Module Standard pins keep their
authority under [governance boundaries](../GOVERNANCE.md). A newer central
revision requires reviewed local adoption where it changes an accepted choice.

Exact runtime, package, native-binary and container versions belong to the
consumer's manifests, lockfiles and accepted adoption records. This reference
does not upgrade them or select moving `latest` tags. A selected technology,
working prototype and qualified production profile are separate claims.

## Selected responsibilities

| Responsibility | Reference choice and boundary |
| --- | --- |
| Primary backend runtime | Node.js and TypeScript. Rust or Go services require a concrete advantage such as measured CPU/memory needs, system integration or a needed library; they keep language-neutral external contracts. |
| TypeScript module composition | Get Modular static composition under the consumer's adopted package and module-standard pins. Each process owns its composition graph; private helpers remain ordinary local code. This does not adopt runtime plugin loading or hot replacement. |
| Public HTTP and RPC | Fastify hosts the public HTTP server; Connect handlers use `@connectrpc/connect-fastify` in that same server/process. Ordinary HTTP routes such as webhooks and health endpoints use the same host where appropriate. |
| RPC contracts | Protobuf and Buf for public APIs and genuine service boundaries. Generated transport types stay behind adapters; local application interfaces do not require `.proto` definitions. |
| Private service invocation | Standard gRPC/Protobuf through Dapr service invocation for real process boundaries. Dapr is an invocation adapter in this profile, not the public product API, business state store or workflow engine. |
| Durable asynchronous delivery | NATS JetStream through the official SDK for the service language; Node.js uses the official modular SDK, behind an owned adapter with durable pull consumers. No Moleculer Channels layer, Channels fork or custom queue implementation. |
| Application persistence | Native PostgreSQL for server and fully local backend profiles. In Node, asynchronous `node-postgres` and Drizzle stay inside context-owned persistence adapters. |
| Durable workflows | Temporal behind the owning application's replaceable workflow port. Contexts retain business-state authority; the engine records workflow progress and recovery. |
| Realtime delivery | Centrifugo behind the application's delivery port. Authoritative reads, snapshots and access decisions remain with their owning application contracts. |
| Server deployment | Docker Compose for server development and small self-hosted installations; Kubernetes for the large hosted profile. Product repositories own topology, capacity, security and operational qualification. |

The [official Connect integration](https://connectrpc.com/docs/node/server-plugins/#fastify)
registers RPC handlers in Fastify; it does not create another network proxy.
RPC-only services can use an appropriate native server adapter without making
Fastify a dependency of every worker. Public Connect protocol and private gRPC
are distinct wire choices, even when their implementations use the same
[Connect library family](https://connectrpc.com/docs/introduction/).

[Dapr gRPC proxying](https://docs.dapr.io/developing-applications/building-blocks/service-invocation/howto-invoke-services-grpc/)
uses ordinary gRPC services and clients through sidecars. The receiving service
still implements its own server and application handlers. Sidecars belong to
participating service processes, not individual agents or every in-process
module. A local function call stays local. Deployment configuration and measured
capacity determine scalability; adopting Dapr does not itself qualify it.

The [official NATS JavaScript modules](https://github.com/nats-io/nats.js#readme)
separate transport and JetStream APIs. The selected
[pull-consumer model](https://docs.nats.io/learn/jetstream/pull-consumers)
keeps demand and bounded consumption with workers. Consumer identity,
acknowledgment, redelivery, idempotency and retention remain explicit adapter and
product contracts. Dapr pub/sub, actors and workflow are not alternate owners
of these selected responsibilities.

## Application and transport boundaries

Application use cases depend on narrow owned ports. Fastify, Connect, generated
wire models, Dapr, database clients and provider SDKs stay in adapters or outer
composition. Follow the existing
[ownership practices](engineering-quality-standard.md#clean-architecture-and-ownership)
instead of adding framework-shaped abstractions or duplicate business logic.

The public adapter establishes the authenticated user and tenant context and
invokes application interfaces. An outbound private RPC adapter calls another
service only when that boundary is needed; internal callers do not loop through
their own public HTTP API. Public and private contracts may differ and must not
expose each other's methods automatically. Each owner retains authorization and
its state boundary across local and remote placement.

GraphQL or another public API style can be added as an input adapter to the same
owned commands and queries. It receives no direct access to another context's
database or a universal service locator. Protocol choice does not create a new
business authority. RPC Protobuf adoption also does not silently migrate the
owning product's integration-event schemas.

Each effectful operation needs an explicit contract for identity, deadlines,
retry, cancellation and uncertain outcomes where applicable. Retry policies at
different layers may handle different failures, but must not independently
recreate the same effect. Keep these semantics with their owners when changing
language, deployment topology or transport.

## Server and fully local backend profiles

A client attached to a hosted target uses its public API. It does not receive
direct PostgreSQL access or start a second local backend merely because the
client runs on a desktop.

A product that adopts fully local execution may package native PostgreSQL,
`nats-server`, backend processes and the required `daprd` sidecars under owned
Supervisor component ports. `embedded-postgres` is the selected PostgreSQL
packaging mechanism for that direction, behind the Node Supervisor adapter;
the hosted profile can use independently operated PostgreSQL. Shared application
ports and persistence semantics do not imply shared process-lifecycle code.
Docker is not a prerequisite for the native local end-user profile.

Fully local delivery remains separately qualified and scheduled by the product.
Exact bundled versions, Windows/macOS/Linux lifecycle and packaging, upgrades,
backup/restore and recovery require evidence before release. The workflow engine
for a local profile is a separate owned selection; choosing Temporal for server
workflows does not automatically require a local Temporal deployment. These
references do not promote an unimplemented profile to supported status.

## Provisional choices and explicit non-decisions

**Keycloak and OpenFGA are the provisional IAM direction**, for identity and
relationship-based authorization respectively. The product's IAM decision must
still bind provider adoption, tenant isolation, revocation/consistency semantics
and deployment evidence. This table does not mark those decisions resolved or
turn provider installation into proof of authorization correctness.

**LangGraph is a candidate, not an adopted backend dependency.** If selected,
its proposed role is a bounded agent graph inside an owned execution capability.
[LangGraph checkpoints](https://docs.langchain.com/oss/javascript/langgraph/persistence)
and [Temporal workflow history](https://docs.temporal.io/workflows) both support
resumption at different scopes. Their integration needs an owning decision for
execution identity, checkpoints, retry and cancellation before implementation.
It must not create a second owner of the same business state or workflow.

Use the existing [risk-based verification workflow](engineering-quality-standard.md#change-workflow-and-evidence):
tests cover changed contracts and credible failures, with the smallest adequate
scope and the repository's required gates. No new validator, test suite or
dependency is required merely to repeat this reference in another repository.
