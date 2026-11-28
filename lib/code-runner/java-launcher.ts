import { COMPILE_BEGIN, COMPILE_END, COMPILE_ERROR_EXIT } from "./launcher-protocol";
import type { IdeFile } from "./types";

/**
 * Piston's official `java` package runs the first file in single-file source
 * mode (`java Main.java`), which can't see any other source file — so a
 * multi-file Java answer would fail with "cannot find symbol". Instead of
 * maintaining a custom Piston package, we prepend this generated launcher:
 * it compiles every student file in-process with the JDK's own compiler API
 * (`javax.tools`), then loads and invokes the entry class's `main`. Compile
 * diagnostics are wrapped in markers and exit with a sentinel code so the
 * client can report them as a compile error, not a runtime one.
 *
 * No extension on purpose: the package's run script does `mv $1 $1.java`
 * before `java $1.java`. A name ending in `.java` would become
 * `IdeLauncher__.java.java`, which javac then trips over while resolving
 * fully-qualified names like `java.util.Scanner`.
 */
export const JAVA_LAUNCHER_FILE = "IdeLauncher__";

const PACKAGE_DECL = /^\s*package\s+([\w.]+)\s*;/m;

function javaString(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Fully-qualified class name of the entry file (honors a `package` declaration). */
export function javaMainClass(entry: IdeFile): string {
  const simple = entry.name.replace(/\.java$/i, "");
  const pkg = entry.content.match(PACKAGE_DECL)?.[1];
  return pkg ? `${pkg}.${simple}` : simple;
}

export function buildJavaLauncher(files: IdeFile[]): IdeFile {
  const sources = files.filter((f) => f.name.toLowerCase().endsWith(".java")).map((f) => javaString(f.name));
  const mainClass = javaString(javaMainClass(files[0]));

  const content = `import java.io.*;
import java.lang.reflect.*;
import java.net.*;
import java.nio.file.*;
import java.util.*;
import javax.tools.*;

public class IdeLauncher__ {
  public static void main(String[] args) throws Exception {
    // The sandbox's default charset is ASCII: force UTF-8 so "ñ"/"á" print correctly.
    System.setOut(new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8"));
    System.setErr(new PrintStream(new FileOutputStream(FileDescriptor.err), true, "UTF-8"));
    String[] sources = new String[] { ${sources.join(", ")} };
    // Inside the submission dir (always writable in the sandbox), not /tmp.
    Path out = Files.createDirectories(Paths.get("ide_classes__"));
    JavaCompiler javac = ToolProvider.getSystemJavaCompiler();
    List<String> opts = new ArrayList<>(Arrays.asList("-d", out.toString(), "-encoding", "UTF-8", "-nowarn", "-g",
        // Only the files listed below: never scan the working directory for implicit sources.
        "-sourcepath", out.toString(), "-classpath", out.toString(), "-implicit:none"));
    opts.addAll(Arrays.asList(sources));
    ByteArrayOutputStream diag = new ByteArrayOutputStream();
    int rc = javac.run(null, diag, diag, opts.toArray(new String[0]));
    if (rc != 0) {
      System.err.print(${javaString(COMPILE_BEGIN)});
      System.err.print(diag.toString("UTF-8"));
      System.err.print(${javaString(COMPILE_END)});
      System.err.flush();
      System.exit(${COMPILE_ERROR_EXIT});
    }
    URLClassLoader loader = new URLClassLoader(new URL[] { out.toUri().toURL() }, ClassLoader.getPlatformClassLoader());
    Thread.currentThread().setContextClassLoader(loader);
    Method main;
    try {
      main = Class.forName(${mainClass}, true, loader).getMethod("main", String[].class);
    } catch (ClassNotFoundException | NoSuchMethodException e) {
      // Java unicode escapes: this file itself is compiled by the ASCII-default source launcher.
      System.err.println("Error: no se encontr\\u00f3 el m\\u00e9todo public static void main(String[] args) en la clase " + ${mainClass} + ".");
      System.exit(1);
      return;
    }
    try {
      main.invoke(null, (Object) args);
    } catch (InvocationTargetException e) {
      Throwable t = e.getCause();
      trim(t);
      System.err.print("Exception in thread \\"main\\" ");
      t.printStackTrace();
      System.exit(1);
    }
  }

  // Hide the launcher and reflection frames so the trace looks like a plain \`java Main\` run.
  private static void trim(Throwable t) {
    for (; t != null; t = t.getCause()) {
      List<StackTraceElement> kept = new ArrayList<>();
      for (StackTraceElement el : t.getStackTrace()) {
        String c = el.getClassName();
        if (c.startsWith("jdk.internal.reflect.") || c.startsWith("java.lang.reflect.") || c.startsWith("IdeLauncher__")
            || c.startsWith("com.sun.tools.javac.launcher.")) continue;
        kept.add(el);
      }
      t.setStackTrace(kept.toArray(new StackTraceElement[0]));
    }
  }
}
`;
  return { name: JAVA_LAUNCHER_FILE, content };
}
