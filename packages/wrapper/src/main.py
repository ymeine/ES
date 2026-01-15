# ---------------------------------------------------------------------------------------------- std

from subprocess import Popen
import sys
import shutil



####################################################################################################
# 
####################################################################################################

def get_exe_path() -> str:
    name = 'es'
    path = shutil.which(name)
    if path is None:
        raise RuntimeError(f'Could not find "{name}" executable in PATH.')
    return path

def main():
    exe = get_exe_path()
    args = sys.argv[1:]
    command = ' '.join([exe] + args) # to make it verbatim
    proc = Popen(command)
    proc.wait()

if __name__ == '__main__':
    main()
