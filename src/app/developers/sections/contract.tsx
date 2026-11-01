import { InlineCode, ProseH2, ProseList, ProseP } from "@/components/ui/prose";
import { RATE_LIMIT_POLICY_TEXT, VERSIONING_POLICY } from "@/lib/api-policy";
import { deprecationSummary, RESPONSE_HEADERS } from "@/lib/developers-content";
import { listOperations, type OpenApiDocument } from "@/lib/openapi";
import { ApiTable } from "./api-table";

/** What the API promises: who may call it, which routes exist, how it is versioned and limited. */

export function AuthenticationSection() {
  return (
    <div className="max-w-2xl">
      <ProseH2 id="authentication">Authentication</ProseH2>
      <ProseP>
        Anvilry has no authentication. Every documented route is public and
        read-only, so there are no API keys, tokens, OAuth flows or accounts,
        and nothing to put in an <InlineCode>Authorization</InlineCode> header.
        The routes that do need a secret (the scheduled jobs and the admin
        dashboard) are operator-only and are not part of this API.
      </ProseP>
    </div>
  );
}

export function EndpointsSection({ openApi }: { openApi: OpenApiDocument }) {
  return (
    <div className="mt-12">
      <h2
        id="endpoints"
        className="scroll-mt-24 text-xl font-semibold tracking-tight text-fg"
      >
        Endpoints
      </h2>
      <div className="mt-4 overflow-x-auto">
        <ApiTable
          caption="Public endpoints of the Anvilry API"
          tableClass="w-full min-w-[40rem] text-sm"
          columns={[
            {
              header: "method",
              cell: "py-2 pr-4 align-top font-mono text-xs uppercase text-fg-muted",
            },
            {
              header: "path",
              cell: "py-2 pr-4 align-top font-mono text-xs text-accent",
            },
            {
              header: "operationId",
              cell: "py-2 pr-4 align-top font-mono text-xs text-fg-muted",
            },
            { header: "what it returns", cell: "py-2 align-top text-fg-muted" },
          ]}
          rows={listOperations(openApi).map(({ path, method, operation }) => ({
            key: operation.operationId,
            cells: [method, path, operation.operationId, operation.summary],
          }))}
        />
      </div>
    </div>
  );
}

export function VersioningSection() {
  return (
    <>
      <ProseH2 id="versioning">Versioning</ProseH2>
      <ProseList items={VERSIONING_POLICY} />
    </>
  );
}

export function RateLimitsSection() {
  return (
    <>
      <ProseH2 id="rate-limits">Rate limits</ProseH2>
      <ProseList items={RATE_LIMIT_POLICY_TEXT} />
    </>
  );
}

export function ResponseHeadersSection() {
  return (
    <div className="mt-6 overflow-x-auto">
      <ApiTable
        caption="Response headers of the public API"
        tableClass="w-full min-w-[40rem] text-sm"
        columns={[
          {
            header: "header",
            cell: "py-2 pr-4 align-top font-mono text-xs text-accent",
          },
          { header: "sent on", cell: "py-2 pr-4 align-top text-fg-muted" },
          { header: "meaning", cell: "py-2 align-top text-fg-muted" },
        ]}
        rows={RESPONSE_HEADERS.map(({ name, sent, meaning }) => ({
          key: name,
          cells: [name, sent, meaning],
        }))}
      />
    </div>
  );
}

export function DeprecationNote() {
  return (
    <ProseP>
      {deprecationSummary()} A preflight (<InlineCode>OPTIONS</InlineCode>)
      request is not counted, and a request refused for an unsupported{" "}
      <InlineCode>API-Version</InlineCode> is not either: both carry the version
      header but no <InlineCode>RateLimit</InlineCode> headers.
    </ProseP>
  );
}
