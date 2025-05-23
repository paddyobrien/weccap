Prerequisites:

You will need a python and nodejs runtimes and package managers, the project is designed to use the package managers UV and yarn:

- [UV python package manager](https://github.com/astral-sh/uv)
- [Yarn](https://yarnpkg.com/)

Once these are available you can start the backend with:

```
uv run --directory . -v server/index.py
``` 

And to start the UI, from `/ui` run:

```
yarn run dev
```

