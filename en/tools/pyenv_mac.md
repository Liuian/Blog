# pyenv for mac & pip

## pyenv
- List all pyenv environments: `pyenv versions`
- List all packages in envs: `pip list`

---

- Setup new pyenv environment: `pyenv virtualenv {python_version} {env_name}` 
- Delete a pyenv environment: `pyenv uninstall {env_name}`

---

- Set a local python version: `pyenv local {env_name}`
- Unset that local version: `rm .python-version`

---

- Activate environment: `pyenv activate {env_name}`
- Deactivate env: `pyenv deactivate`

--

- Search all avaliable versions for pyenv: `pyenv install --list`
- Install a new python version in pyenv: `pyenv install {python_version}`

---

## pip
- Set a requirements.txt to record packages: `pip freeze > requirements.txt`
- Install all packages in requirements.txt: `pip install -r requirements.txt`

