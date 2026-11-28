# GASD Enhancement Proposal (GEP)

```text
GEP: 8
Title: Target-Independent Executable Entry Point
Author: Agentic Software Design (https://github.com/agentic-software-design)
Status: Draft
Type: Standards Track
Created: 2026-11-27
Requires: GEP 6 (GASD 1.2)
```

---

# Abstract

Add an optional `ENTRYPOINT` directive to GASD 1.2 so a design can designate the `FLOW` that runs when a standalone executable launches. An executable design may declare at most one `ENTRYPOINT` across all its source files. When present, the generator translates it into the target's launch convention, such as `func main()` in Go.

---

# Motivation

GASD 1.2 defines `TARGET` to select an implementation language and `FLOW` to describe behavior. A design can use a `say_hello` flow to return a greeting. To generate a command that prints the greeting when run, the generator also needs to know which flow to invoke at launch. [GASD 1.2 directives](../GASD-1.2/GASD_Specification.md#3-context--directives) · [Hello World with `ENTRYPOINT`](../GASD-1.2/GASD_Specification.md#appendix-b-hello-world-example)

If a document defines both `greet` and `check_config`, its flow definitions alone leave the startup choice open. A generator can choose by convention, which can make moving or renaming a flow change launch behavior. The build can also carry a separate entry point setting, which reviewers then need alongside the design. An explicit declaration lets authors record the choice, lets validators check it before generation, and gives different target generators the same startup intent. [GASD 1.2 determinism conformance](../GASD-1.2/GASD_Specification.md#121-determinism-conformance)

---

# Specification

## Syntax and name resolution

Add `entrypoint_stmt` as a top-level `section` alternative in Appendix A. The directive follows the required `CONTEXT` and `TARGET` directives and may precede the referenced flow. It uses the same identifier grammar as a `FLOW` declaration.

```ebnf
section         ::= context_dir | namespace_stmt | import_stmt | entrypoint_stmt
                  | decision_blk | type_def | component_def | contract_def
                  | flow_def | strategy_def | constraint | model_def
                  | assumption_def | resources_stmt
entrypoint_stmt ::= "ENTRYPOINT" ":" identifier
```

- A document **MAY** declare at most one `ENTRYPOINT`. The GASD parser **MUST** reject multiple declarations in the same document, including repeats of the same name.
- The identifier **MUST** match the name of exactly one top-level `FLOW` declared in the same document. Resolve it by its GASD name before applying target naming rules. A missing, ambiguous, or imported-only match is a validation error.
- The designer chooses the selected flow's parameters, return type, and body with the capabilities of the selected `TARGET` in mind. The parser **MUST** validate the flow using the ordinary `FLOW` rules. [GASD 1.2 design flows](../GASD-1.2/GASD_Specification.md#7-design-flows--flow)

## Combined executable validation

When validating a set of GASD files as one executable, the GASD parser **MUST** allow at most one `ENTRYPOINT` across the combined design. Apply that count across all included source documents regardless of their `NAMESPACE` values or whether they omit `NAMESPACE`. Include documents reached through `IMPORT` and count each resolved document once, even if it is supplied directly and reached through an import or reached through multiple imports. Any included document may declare the entry point, and its identifier resolves in that document.

Zero declarations satisfy this rule. The parser **MUST** report a duplicate-entry-point error for two or more declarations and identify the file and line of each, even when the identifiers are identical. The caller selects executable validation, and the parser runs this check during semantic validation, including when exporting a combined AST for that executable. A single-file executable follows the same rule.

## Executable generation

When `ENTRYPOINT` is declared, the generator **MUST** verify that the selected `TARGET` supports standalone execution and can implement the flow's parameter types, return type, statements, and startup behavior. This includes input bindings and result handling specified in the design or build configuration. If the target cannot support a required part of the design, generation **MUST** fail with a diagnostic that identifies the target and the unsupported requirement.

For a target that requires a named entry function or method, compare that name with the selected flow's emitted name. If the names match and the entry function can preserve the designed behavior, the generator **MUST** emit the flow body there. If the names differ, the generator **MUST** preserve the flow's emitted name and emit a native launcher that calls it directly. A matching name can still require a launcher to adapt inputs or results or preserve ordinary calls to the flow. In that case, give the separately emitted flow a distinct, deterministic name and use it at every call site.

For a target that launches a file or module, the generator may put the flow body in the launch code or emit the flow as a function and call it directly from there. Preserve any import behavior specified by the design.

An executable generated with an `ENTRYPOINT` **MUST** invoke the selected flow once on normal launch. When the directive is omitted, startup follows the applicable target or build configuration. For library or host-managed generation, the caller or host controls invocation.

## Mapping during code generation

1. **Use the resolved flow.** Start with the selected flow and its declaring document from semantic validation. The GASD identifier identifies the flow across target naming changes.
2. **Select the launch form.** Use the language version and runtime specified by `TARGET` and the executable build configuration. Choose the required function or class signature, script, or module.
3. **Resolve launch bindings.** Determine where each flow parameter gets its value and how the launcher handles the result, using the design and applicable build configuration. Check conversions, argument order, and any required process status or shutdown behavior. If a required parameter has no compatible source, report the target and parameter at generation time. An integer result is used as a process exit status when the design or build configuration specifies that mapping.
4. **Emit startup code.** Apply the name and compatibility checks above to choose direct emission or a single launcher call to the flow. Emit any required input and result adaptation and update ordinary call sites if the flow symbol was renamed.

## Entry-point conventions by target

`ENTRYPOINT: main` selects the GASD flow named `main`. A designer can also write `ENTRYPOINT: greet`, and the generator supplies the target's launch form. The mappings below show how typical command-line programs can supply arguments and process status when the design calls for them.

| Target | Typical launch form | Input and result mapping |
| --- | --- | --- |
| C (hosted) | `int main(void)` or `int main(int argc, char *argv[])`. | Build the flow's argument list from `argv[1]` through `argv[argc - 1]` when present. Return the status from `main` using a value supported by the host. [C working draft, Program startup](https://www.open-std.org/JTC1/sc22/wg14/www/docs/n3220.pdf#page=26) |
| C++ (hosted) | Global `int main()` or `int main(int argc, char *argv[])`. | Convert the arguments after `argv[0]` to the flow's expected type and return the mapped status from `main`. If other flows call the selected flow, emit a separate callable function because C++ prohibits ordinary calls to its global `main`. [C++ working draft](https://eel.is/c++draft/basic.start.main) |
| Go | `func main()` in `package main`, with no parameters or return value. | Read user arguments from `os.Args[1:]`. Call `os.Exit(status)` after the flow returns if the design requires explicit process exit. `os.Exit` terminates immediately, so preserve any required cleanup first. [Go specification](https://go.dev/ref/spec#Program_execution) · [Go `os` package](https://pkg.go.dev/os#Exit) |
| Rust | Zero-argument `fn main()`. The return type can implement `Termination`, such as `Result<(), E>` with `E: Debug`. | Read user arguments with `std::env::args_os().skip(1)` and convert them to the expected type. Return a compatible `ExitCode` from `main` for a mapped numeric status. [Rust Reference](https://doc.rust-lang.org/reference/crates-and-source-files.html#main-functions) · [Arguments](https://doc.rust-lang.org/std/env/fn.args_os.html) · [ExitCode](https://doc.rust-lang.org/std/process/struct.ExitCode.html) |
| Java | `public static void main(String[] args)` on the launch class. Java 25 and later also accept forms such as an instance `void main()` with no parameters. | Pass the launch method's `args` to the flow when it needs command-line input. Use `System.exit(status)` when the design requires terminating the JVM with that status. [Java Language Specification](https://docs.oracle.com/javase/specs/jls/se25/html/jls-12.html#jls-12.1.4) · [System.exit](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/System.html#exit(int)) |
| Scala (JVM) | `def main(args: Array[String]): Unit` in an `object`, or a Scala 3 method marked `@main`. | Use the launch method's `args`, or use Scala 3's typed argument conversion when it fits the design. Call `scala.sys.exit(status)` for an explicit JVM exit. [Scala main methods](https://docs.scala-lang.org/scala3/book/methods-main-methods.html) · [Scala exit](https://www.scala-lang.org/api/2.13.16/scala/sys/index.html) |
| Python | Launch a script or module, commonly by calling a function under `if __name__ == "__main__":`. For `python -m package`, use `__main__.py`. | Bind user arguments from `sys.argv[1:]`. Pass an explicitly mapped status to `sys.exit()` from the launcher. [Python launch modules](https://docs.python.org/3/library/__main__.html) · [Python `sys` module](https://docs.python.org/3/library/sys.html#sys.argv) |
| JavaScript (Node.js) | `node app.js` runs the selected module. The module can call the generated flow explicitly. | Use `process.argv.slice(2)` for a file launch. Assign a mapped status to `process.exitCode` when the design allows the event loop to drain before exit. [Node.js CLI](https://nodejs.org/api/cli.html#program-entry-point) · [Arguments](https://nodejs.org/api/process.html#processargv) · [Process exit code](https://nodejs.org/api/process.html#processexitcode) |
| C# (.NET) | `static void Main(string[] args)`, `static int Main(string[] args)`, or top-level statements. | Pass `args` as user arguments. Return a mapped status from `int Main`, or use `Task<int>` when the launcher awaits asynchronous work. [C# documentation](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/program-structure/main-command-line) |
| Kotlin (JVM) | `fun main()` or `fun main(args: Array<String>)`. | Pass `args` from the second form for command-line input. Call `kotlin.system.exitProcess(status)` for an explicit process exit. [Kotlin entry point](https://kotlinlang.org/docs/basic-syntax.html#program-entry-point) · [Kotlin exitProcess](https://kotlinlang.org/api/core/kotlin-stdlib/kotlin.system/exit-process.html) |
| Swift | Executable top-level code, commonly in `main.swift`, or an `@main` type with `static func main()`. | Read user arguments with `CommandLine.arguments.dropFirst()` and adapt the sequence to the flow's expected type. Use the selected platform's process-exit API for an explicitly mapped status. [Swift language reference](https://docs.swift.org/latest/documentation/the-swift-programming-language/declarations/#Top-Level-Code) · [Swift arguments](https://developer.apple.com/documentation/swift/commandline/arguments) |

## Hello World across targets

```gasd
VERSION 1.2
CONTEXT: "Command-line application"
TARGET: "Go"
NAMESPACE: "example.hello"
ENTRYPOINT: greet

CONSTRAINT: "Exit successfully on normal completion."

FLOW greet():
    1. ACHIEVE "Write Hello, World! followed by a newline to standard output":
        POSTCONDITION:
            stdout.line_count == 1
            stdout.last_line == "Hello, World!"
```

Select each target in `TARGET`. The flow body stays the same and each version prints `Hello, World!` followed by a newline. The postcondition refers to captured standard output. `line_count` counts newline-terminated lines and `last_line` excludes the terminator.

Each pair starts with `ENTRYPOINT: greet`. For the direct form on targets with a named entry function, rename both the directive's identifier and the `FLOW` declaration to `main`, or `Main` for C#. For Python and Node.js, direct emission places the body in the startup code of the launch file.

### C

**Launcher calls `greet`**

```c
#include <stdio.h>

static void greet(void) {
    puts("Hello, World!");
}

int main(void) {
    greet();
    return 0;
}
```

**Flow emitted as `main`**

```c
#include <stdio.h>

int main(void) {
    puts("Hello, World!");
    return 0;
}
```

### C++

**Launcher calls `greet`**

```cpp
#include <iostream>

static void greet() {
    std::cout << "Hello, World!\n";
}

int main() {
    greet();
    return 0;
}
```

**Flow emitted as `main`**

```cpp
#include <iostream>

int main() {
    std::cout << "Hello, World!\n";
    return 0;
}
```

### Go

**Launcher calls `greet`**

```go
package main

import "fmt"

func greet() {
	fmt.Println("Hello, World!")
}

func main() {
	greet()
}
```

**Flow emitted as `main`**

```go
package main

import "fmt"

func main() {
	fmt.Println("Hello, World!")
}
```

### Rust

**Launcher calls `greet`**

```rust
fn greet() {
    println!("Hello, World!");
}

fn main() {
    greet();
}
```

**Flow emitted as `main`**

```rust
fn main() {
    println!("Hello, World!");
}
```

### Java

**Launcher calls `greet`**

```java
public class Hello {
    private static void greet() {
        System.out.println("Hello, World!");
    }

    public static void main(String[] args) {
        greet();
    }
}
```

**Flow emitted as `main`**

```java
public class Hello {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
```

### Scala on the JVM

**Launcher calls `greet`**

```scala
object Hello {
  private def greet(): Unit = {
    println("Hello, World!")
  }

  def main(args: Array[String]): Unit = {
    greet()
  }
}
```

**Flow emitted as `main`**

```scala
object Hello {
  def main(args: Array[String]): Unit = {
    println("Hello, World!")
  }
}
```

### Python

**Launch file calls `greet`**

```python
def greet():
    print("Hello, World!")


if __name__ == "__main__":
    greet()
```

**Flow emitted as guarded launch code**

```python
if __name__ == "__main__":
    print("Hello, World!")
```

### JavaScript on Node.js

Both forms are emitted into the dedicated launch module.

**Entry module calls `greet`**

```javascript
function greet() {
    console.log("Hello, World!");
}

greet();
```

**Flow emitted as module startup code**

```javascript
console.log("Hello, World!");
```

### C#

**Launcher calls `Greet`**

```csharp
using System;

internal static class Hello
{
    private static void Greet()
    {
        Console.WriteLine("Hello, World!");
    }

    private static void Main()
    {
        Greet();
    }
}
```

**Flow emitted as `Main`**

```csharp
using System;

internal static class Hello
{
    private static void Main()
    {
        Console.WriteLine("Hello, World!");
    }
}
```

### Kotlin on the JVM

**Launcher calls `greet`**

```kotlin
private fun greet() {
    println("Hello, World!")
}

fun main() {
    greet()
}
```

**Flow emitted as `main`**

```kotlin
fun main() {
    println("Hello, World!")
}
```

### Swift

These examples use a type-based entry point.

**Launcher calls `greet`**

```swift
@main
struct Hello {
    private static func greet() {
        print("Hello, World!")
    }

    static func main() {
        greet()
    }
}
```

**Flow emitted as `main`**

```swift
@main
struct Hello {
    static func main() {
        print("Hello, World!")
    }
}
```

## Worked mapping for arguments and exit status

This GASD design binds `run.args` to the user arguments and uses the flow result as the process exit status. The executable exits with status `2` for an empty argument list and `0` otherwise. Both translations keep `run` separately callable.

```gasd
VERSION 1.2
CONTEXT: "Command-line application"
TARGET: "Go"
NAMESPACE: "example.cli"
ENTRYPOINT: run

CONSTRAINT: "Bind run.args to the user-supplied command-line arguments in order."
CONSTRAINT: "Use the value returned by run as the process exit status."

FLOW run(args: List<String>) -> Integer:
    1. IF args.length == 0:
        1. RETURN 2
    2. RETURN 0
```

In Go, `main` supplies the argument slice and passes the flow's result to `os.Exit`.

```go
package main

import "os"

func main() {
	os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
	if len(args) == 0 {
		return 2
	}
	return 0
}
```

With a JavaScript target using Node.js, the entry module calls the same flow with the user argument slice and sets the status for normal process exit.

```javascript
function run(args) {
    if (args.length === 0) {
        return 2;
    }
    return 0;
}

process.exitCode = run(process.argv.slice(2));
```

---

# Rationale

A document-level directive puts the startup decision alongside `TARGET`. Checking the combined design catches conflicting declarations that file-by-file validation would miss. The same flow can also be called as ordinary logic in another context.

A flow annotation such as `@entrypoint` would also make startup explicit and could be checked just as deterministically. It is convenient when reading the flow itself. In a multi-file build, the specification would still need to define which document owns startup and how to handle multiple annotations. A directive expresses that ownership directly and gives authors one place to look.

Inferring the entry point from a name such as `main` keeps the source short, but it couples launch behavior to a naming convention. An explicit build setting also works and is appropriate when a host owns startup. It makes the build setting part of the information needed to reproduce that executable.

The designer can specify how command-line arguments supply flow inputs and how a return value is used, including whether it determines a process exit code. The same directive can select flows with different signatures as those design needs vary.

---

# Backwards Compatibility

Existing GASD 1.2 documents can continue to use their existing generation modes. Standalone executable, library, and host-managed designs may all omit `ENTRYPOINT`. To adopt GASD-defined startup for an executable, add `ENTRYPOINT` to the source document that defines the startup flow.

Authors using the directive specify `VERSION 1.2` in the declaring document and need a parser and generator that support `ENTRYPOINT`. [GASD 1.2 specification](../GASD-1.2/GASD_Specification.md#31-executable-entry-point-entrypoint)

---

# Reference Implementation (Optional)

The GASD 1.2 metamodel defines `ENTRYPOINT` as a directive and models the validated executable's optional flow identity. During parsing, preserve each occurrence and its source location. Validate its reference against the declaring document's flows. In executable validation mode, check the combined set of documents for duplicates before reporting success or exporting a validated combined AST with `--ast-combine`. When a declaration is present, pass the resolved flow and its declaring document to the generator. Check target support before emitting the native entry point. [GASD 1.2 metamodel](../GASD-1.2/gasd-1.2.gasd)

---

# Test Plan

| ID | Type | Expected result |
| --- | --- | --- |
| `AT-GEP8-001` | Acceptance | The Hello World design preserves `greet` in the AST and resolves it to the local flow. For each target, the launcher calls the emitted `greet` flow once and the program prints the greeting and exits successfully. |
| `AT-GEP8-002` | Acceptance | A design with two flows invokes only its declared entry point at launch. Reordering the flow definitions selects the same flow. |
| `AT-GEP8-003` | Acceptance | A combined executable that spans different namespaces passes when one included document contains the sole directive. The result is the same when the document is supplied directly and also reached through an import, or when input order changes. |
| `AT-GEP8-004` | Acceptance | For targets with a named entry function, an emitted name that matches the compatible entry point places the flow body directly in that function. Each direct Hello World example prints the greeting once and exits successfully. |
| `AT-GEP8-005` | Acceptance | A combined executable with zero declarations passes the entry-point check in both validation and combined AST export. |
| `AT-GEP8-006` | Acceptance | `ENTRYPOINT: greet` resolves to `FLOW greet(name: String) -> String:`. The parser accepts this signature, and the generated launcher supplies the input and handles the result as specified by the designer. |
| `AT-GEP8-007` | Acceptance | A selected Go flow named `main` takes a parameter and is also called by another flow. When emitted separately, it receives a distinct, deterministic name. The launch wrapper and the other flow both call that symbol. |
| `AT-GEP8-008` | Acceptance | Both Hello World forms for Python and Node.js print the greeting once on launch. Importing either Python script leaves its guarded launch code inactive. |
| `AT-GEP8-009` | Acceptance | The Go and Node.js translations of the argument-binding example exit with status `2` when invoked without user arguments, and `0` when a user argument is present. |
| `RT-GEP8-001` | Regression | Existing GASD 1.2 files without the directive still parse. A combined library design with zero declarations passes validation. |
| `NT-GEP8-001` | Negative | Validation rejects duplicate directives, unknown or ambiguous names, and names that match only an imported flow. |
| `NT-GEP8-004` | Negative | The parser rejects declarations in two different documents and identifies both source locations. Test shared, distinct, and omitted namespaces, and matching and differing entry point identifiers. |
| `NT-GEP8-005` | Negative | Executable generation reports an error when the target cannot produce a standalone executable. |
| `NT-GEP8-006` | Negative | A flow passes ordinary validation and requires a type, statement, input binding, or result mapping that its target cannot support. Generation fails and identifies the target and the unsupported requirement. |

---

# Traceability

| Requirement | GASD 1.2 specification and artifacts | Tests |
| --- | --- | --- |
| Parse an optional startup reference per document | [Entry-point validation](../GASD-1.2/GASD_Specification.md#31-executable-entry-point-entrypoint) · [Formal EBNF grammar](../GASD-1.2/GASD_Specification.md#appendix-a-formal-ebnf-grammar) · [Metamodel](../GASD-1.2/gasd-1.2.gasd) | `AT-GEP8-001`, `RT-GEP8-001`, `NT-GEP8-001` |
| Resolve a local flow and apply ordinary flow validation | [Design flows](../GASD-1.2/GASD_Specification.md#7-design-flows--flow) | `AT-GEP8-002`, `AT-GEP8-006`, `NT-GEP8-001` |
| Allow zero or one declaration across a combined executable | [Combined executable validation](../GASD-1.2/GASD_Specification.md#combined-executable-validation) | `AT-GEP8-003`, `AT-GEP8-005`, `RT-GEP8-001`, `NT-GEP8-004` |
| Check target support and emit startup code | [Executable generation](../GASD-1.2/GASD_Specification.md#131-executable-entry-point-generation) · [Target conventions](#entry-point-conventions-by-target) · [Hello World across targets](#hello-world-across-targets) | `AT-GEP8-001`, `AT-GEP8-002`, `AT-GEP8-004`, `AT-GEP8-006`, `AT-GEP8-007`, `AT-GEP8-008`, `NT-GEP8-005`, `NT-GEP8-006` |
| Apply the specified argument and exit-status bindings | [Worked mapping](#worked-mapping-for-arguments-and-exit-status) | `AT-GEP8-009` |

---

# Change History

```text
2026-11-27 — Initial draft
2026-11-27 — Defined parser validation across all files and namespaces in a combined executable
2026-11-27 — Made the directive optional in combined executable validation
2026-11-27 — Applied ordinary flow rules to entry-point signatures and bodies
2026-11-27 — Defined target compatibility checks during executable generation
2026-11-27 — Allowed direct emission as the target's native entry point
2026-11-27 — Documented common target entry-point conventions and script examples
2026-11-27 — Analyzed target code generation, argument bindings, and process exit status
2026-11-27 — Mapped one Hello World design to launcher and direct forms for all listed targets
2026-11-27 — Incorporated the directive into the GASD 1.2 specification and metamodel
```
