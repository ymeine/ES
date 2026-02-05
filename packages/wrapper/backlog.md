## Add a script to delete latest release

I can use gh CLI or already installed JavaScript library.

Once the latest release has been identified, display all relevant information to be able to double check it's the right one.

Then display a confirmation prompt, defaulting to "no", to avoid accidental deletion.

## Change tool/exe name to "everything" to avoid conflict with original "es"

The goal is to make it possible for original `es.exe` and my wrapper `everything.exe` to co-exist.

Oen thing is to change my scripts to output a `everything.exe` file. Not complicated.

The rest, it all depends on how mise's GitHub backend works. I'd like to be able to specify my dependency with just a version number, not additional configuration.

So: 

- if mise is able to find a package named "everything", even though the repository is named "es", then we're good
- otherwise if it requires a package names "es" but is able to detect that the exe file to shim inside is "everything.exe" (pick first root exe file), then we're also good
- otherwise, I will have to create a separate repository named "everything" just for the wrapper

The last option involved more setup, but is actually cleaner, since building such a wrapper is independent of the original project.

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
