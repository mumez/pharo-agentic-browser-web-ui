# Crit Diff Review Integration

Status: accepted  
Date: 2026-10-06

This document is the contract for opening a [crit](https://github.com/tomasz-tomczyk/crit) diff review from the web UI. Give the whole document to each implementing agent. Each agent implements only its own work section, and both agents follow the Specification.

| Repository | Work section |
|---|---|
| [pharo-agentic-browser](https://github.com/mumez/pharo-agentic-browser) | [Server work](#server-work) |
| [pharo-agentic-browser-web-ui](https://github.com/mumez/pharo-agentic-browser-web-ui) (this repository) | [Web UI work](#web-ui-work) |

## Problem

The web UI cannot show the working tree diff. Reviewers currently ask the agent to start crit, then open the localhost URL that crit prints. That URL is wrong when the browser is on another machine on the LAN, and a random port is awkward to allow through a host firewall such as Windows Firewall.

## Specification

### Operator settings

Add two global `AbSettings` keys, persisted in `ab-settings.json`. They are image-wide. They are not per-topic settings and they are not edited by the web UI.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `useCritIntegration` | boolean | `false` | Master switch. When `false`, do not assign ports and do not launch crit. |
| `critPortRange` | string | `8050-8090` | Inclusive port range used only when assigning a port to a newly created working directory. |

`critPortRange` matches `^[0-9]+-[0-9]+$`. Both ends are integers from 1 through 65535, and the low end is less than or equal to the high end. A value that does not match is invalid. Do not trim creative variants (`8050 - 8090`, `8050–8090`, lists, CIDR). An invalid range must not fall back to a random port.

The default range includes 8080, which is the default Ripple/Teapot port. The allocator skips any port that is already bound, so 8080 is skipped while Teapot is listening. Operators who want a cleaner firewall rule can set a range that does not contain the web UI port.

### Why the port lives in the working directory

`.crit.config.json` is the record of the port. A person can open the topic working directory and see which port crit will use without reading the Pharo image. The server reads that file when it builds `TopicData` and when it launches crit. It does not keep a second assignment table.

`agenticBrowserRoot` is not a git repository. Each topic working directory is the git root. crit reads a project `.crit.config.json` from the git root, or from the current directory when the directory is not a git repository yet. Launching crit with its current directory set to the topic working directory therefore uses the file in that directory, both before and after `git init`.

### Template

Ship this file as `topic-template/.crit.config.json`:

```json
{
  "port": 0,
  "no_open": true,
  "ignore_patterns": [".crit.config.json"]
}
```

Also ensure `topic-template/.gitignore` contains the line `.crit.config.json`.

crit ignores `host` in a project `.crit.config.json`. Do not put `host`, `public_url`, or `--allow-unauthenticated-network` in this file. `port` and `no_open` are honored from the project file. `ignore_patterns` keeps the config file out of crit's review file list. The gitignore line keeps it out of the topic repository's git status. The topic working directory is a git repository, so both exclusions are required.

`port: 0` means "not assigned". crit treats port 0 as "choose a random port". The server must overwrite `port` before the first launch whenever it is responsible for assigning one.

If a user's `topic-template` directory already exists, add these entries when they are absent. Do not overwrite an existing `.crit.config.json` in `topic-template`. Append the gitignore line only when that line is missing.

### Port assignment

Assign a port only when all of the following are true:

- `useCritIntegration` is `true`
- `critPortRange` is valid
- a new working directory is being created under the AgenticBrowser root and is about to be seeded from `topic-template`

Do this immediately after the template copy, before the directory is used and before crit can start. Parse the copied JSON, set `port` to the chosen integer, and write the object back. Preserve every other key.

Choose the lowest port in the range for which all of the following hold:

- no reserved port already uses it
- a TCP bind on that port succeeds (probe and release it)

A reserved port is an integer `port` greater than 0 in a `.crit.config.json` found in either of these places:

- the working directory of any existing topic, including a custom absolute path
- a direct child directory of the AgenticBrowser root, except `topic-template` and `screenshots`

Hand-written files count. `port: 0` reserves nothing. Changing `critPortRange` later does not rewrite ports that are already stored. A stored port outside the current range stays in force.

If the seeded directory has no `.crit.config.json`, write the standard template and then set `port`. This covers a `topic-template` that could not receive the file. It does not apply to directories that were not seeded.

If no port qualifies, fail creation of that new directory, remove the directory just created for this request, and do not create the topic. The web UI request `/topics/create` returns failure code `10011` with message `No free crit port in range <critPortRange>`. Do not delete a directory that already existed.

Do not assign a port when:

- `useCritIntegration` is `false` (leave the copied file at `port: 0`, or leave the directory unchanged when the template was not copied)
- the caller reuses an existing directory
- the caller points at an existing project path, which already does not receive `topic-template`
- a topic is copied (it keeps the source topic's working directory and therefore the same file)

Existing working directories are not migrated. The operator copies `.crit.config.json` into those directories when they want them included. After that, the file is read and crit is launched under the same rules as a generated file. No backfill job.

### Launch

Launch crit when an AI session starts for a topic: the moment the server connects or reconnects the ACP session for a prompt (the transition into `#working` on send). Do this for the native UI, the web UI, and the scripting DSL.

Skip the launch when `useCritIntegration` is `false`, when the working directory has no `.crit.config.json`, or when `port` is missing or not an integer greater than 0.

Read `port` from that file at launch time, so a hand-edited file is what runs. If `127.0.0.1:<port>` already accepts a TCP connection, do not start another process. A second `crit` attaches to the running daemon and blocks until the review is finished.

Otherwise spawn a detached process. Do not wait for it to exit. The current directory is the topic working directory. The command is:

```bash
crit --no-open --host 0.0.0.0 --allow-unauthenticated-network --port <port>
```

`--host 0.0.0.0` is what makes the review reachable from other machines on the LAN. Binding a single private address, or a CIDR such as `192.168.0.0/16`, is not the listen address. crit accepts one host, and a specific address stops accepting `127.0.0.1`, which the "already listening" check uses. Restricting clients to the private network is a firewall rule, not a crit flag. See [Operator firewall rule](#operator-firewall-rule).

`--allow-unauthenticated-network` is required because crit has no authentication. Anyone who can open the port can read the worktree and write review comments. `useCritIntegration` defaults to `false` so this exposure is opt-in. The trust boundary matches the web UI, which is already a single-user LAN service with no authentication.

`--no-open` is also in the config file. Pass it on the command line as well so the server machine does not open a desktop browser when the file is missing `no_open`.

`crit` must be on the `PATH` of the Pharo process. After spawn, wait until `127.0.0.1:<port>` accepts a TCP connection, for at most 5 seconds. Then continue session startup. If `crit` is missing, the spawn fails, or the port is not accepting connections within 5 seconds, log the failure and continue the AI session anyway. A crit failure must not prevent the agent from running.

Do not stop the daemon when a turn ends, when a topic is deleted, or when the image quits. After an image restart the process is gone; the next session start launches it again on the same port.

One daemon serves every topic that shares a working directory.

### TopicData

When serializing `TopicData` (`/topics/list`, `topicAdded`, and any other payload that carries `TopicData`), include `critPort` only when `useCritIntegration` is `true` and the topic's working directory has a `.crit.config.json` whose `port` is an integer greater than 0.

```json
{
  "topicId": "abc123",
  "title": "My Topic",
  "name": "my-topic",
  "status": "initial",
  "agentArguments": ["claude-code"],
  "goal": "",
  "currentModel": "",
  "currentMode": "",
  "lastUpdated": "2026-10-06T11:00:00+09:00",
  "workingDirectoryPath": "/home/user/pharo/agentic-browser/my-topic-abc12345",
  "critPort": 8051
}
```

Omit the key otherwise. Do not send `0` or `null`. Topics that share a directory report the same `critPort`. The value is read from the file at serialization time. It is not stored in the Fuel topic snapshot.

### Review URL

The browser opens:

```text
http://<hostname>:<critPort>/
```

`<hostname>` is the hostname the browser used to open the web UI (`window.location.hostname`), not `localhost` and not a URL parsed from crit's stdout. crit prints `http://localhost:<port>` even when it is bound to `0.0.0.0`. Ignore that text.

The scheme is always `http`. crit does not serve TLS. A page opened as `http://192.168.1.10:8080/assets/agentic-browser/` opens the review at `http://192.168.1.10:8051/`.

The button may be shown as soon as `critPort` is present, including before the first prompt. Until the session start has launched the daemon, the browser will fail to connect. The web UI does not start crit itself.

### Operator firewall rule

This is not a code task. On a host that filters inbound connections, allow inbound TCP to the configured port range for the private network profile. On Windows Firewall, scope the rule to Private and to the local subnet (or to `10.0.0.0/8`, `172.16.0.0/12`, and `192.168.0.0/16`). Binding to `0.0.0.0` without that rule exposes the port on every interface.

### Out of scope

- Creating `.crit.config.json` in working directories that already exist
- A web UI form for `useCritIntegration` or `critPortRange`
- Proxying crit through the Teapot port
- Publishing the review through `crit share` or crit.md
- Stopping or restarting the daemon from the web UI
- Coordinating port allocation across multiple Pharo images on one machine

## Server work

Repository: https://github.com/mumez/pharo-agentic-browser

Implement the Specification in the image. Do not change the web UI client.

1. Add `useCritIntegration` and `critPortRange` to `AbSettings`, including `ab-settings.json` persistence, defaults, and the global Settings dialog. Leave per-topic settings unchanged.
2. Add `topic-template/.crit.config.json` and the `.gitignore` line as specified, including the "add if absent" behavior for a template directory that already exists on disk.
3. After seeding a new AgenticBrowser-root working directory from `topic-template`, assign `port` as specified. Wire the failure into `/topics/create` as failure code `10011` and document it in `docs/web-ui-api.md`. Clean up only the directory created for the failed request.
4. On ACP session connect for a prompt, launch crit as specified. Cover the native UI, `AbTopicManagerRipple` prompt send, and the scripting DSL, since they share session startup. A missing `crit` binary or a failed bind must not fail the agent session.
5. Add optional `critPort` to every `TopicData` serialization, under the rules in the Specification. Update `docs/web-ui-api.md` (`TopicData` and the error-code table).
6. Add SUnit coverage for: range parsing; lowest-free-port selection; skip of a port held by another directory's config file, including a hand-written one; skip of a bound port; `port: 0` not reserving a port; no assignment when the setting is off; no assignment when reusing an existing directory; `10011` when the range is exhausted; `critPort` present or omitted in the Ripple payload; launch skipped when the port is already accepting connections; session startup continuing when `crit` cannot be started.

Do not shell out to crit in unit tests. Fake the process spawn and the TCP probe.

## Web UI work

Repository: https://github.com/mumez/pharo-agentic-browser-web-ui

Implement only the client. If the payload does not match this document, do not invent a client-side launch path or a second request. The server starts crit.

1. Add optional `critPort?: number` to `TopicData` in `src/types.ts`.
2. In the `ChatConsole` header, show a **Review diff** control only when the selected topic has a `critPort` integer greater than 0. Place it with the existing header actions so it is available on desktop and mobile.
3. The control is a link, not a click handler that starts a process. `target="_blank"` and `rel="noopener noreferrer"`. The href is `http://` plus `window.location.hostname` plus `:` plus `critPort` plus `/`. When `hostname` contains a colon, wrap it in square brackets. Do not append the web UI's port. Do not read a URL from the chat transcript.
4. Do not add settings fields or a settings form for `useCritIntegration` or `critPortRange`.
5. Test the URL builder: hostname from the page, IPv6 bracketing, crit port, `http` scheme, no web UI port. Test that the control is shown for a positive `critPort` and hidden when the field is absent, zero, or not a positive integer. Follow the existing Vitest setup. A missing `critPort` must leave current topic screens unchanged.

There is no new Ripple request. Creation failure `10011` already surfaces through the existing request-error path; do not add a special case unless the current error display drops the server message.
