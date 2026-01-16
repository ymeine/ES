# ---------------------------------------------------------------------------------------------- std

from subprocess import Popen
import sys
import shutil
from pathlib import Path



####################################################################################################
# 
####################################################################################################

def resolve_path(input: str) -> str:
    path = shutil.which(input)
    if path is None:
        raise RuntimeError(f'Could not find "{input}" executable in PATH.')
    return path

def run(input_exe_path: str | Path):
    exe_path = resolve_path(str(input_exe_path))
    args = sys.argv[1:]
    command = ' '.join([exe_path] + args) # to make it verbatim
    proc = Popen(command)
    proc.wait()
