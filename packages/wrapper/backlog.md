## Improve release notes

Write a global description of "why". Something like: 

> Everything CLI does custom parsing of the command line. Therefore, it expects a "verbatim" command line when invoked, which is not practical to achieve most of the time.
> The wrapper here accepts modern command line with quotes and escapes, and converts it back to a verbatim command line for Everything CLI to consume.

Then, describe assets more. For a given asset name, indicate: platform, architecture, whether it embeds the original `es.exe` or not, etc.

## Provide a bare asset

This asset would not embed the original `es.exe` file.

But that leads to the eternal question: how to handle versioning? **Any** project acting as a wrapper around another project suffers from the problem of combining versions.

My wrapper, whether it embeds `es.exe` or not, can be updated, and that for a same version of `es.exe`. How would I version that?

The problem here is even more complex since I would have one asset linked to a version of `es.exe`, and another not. It would not make sense to republish the bare asset every time I release a new embedding asset.

And I should always respect compatibility with package managers, like [mise-en-place](https://mise.jdx.dev/) for instance.
