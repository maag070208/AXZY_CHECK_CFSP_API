import re
import sys

def fix_yaml():
    with open("swagger.yaml", "r", encoding="utf-8") as f:
        content = f.read()
    
    # We will just run a python script that fixes all bad indentations of "200":
    # It seems the replacement made `        "200":` preceded by the spaces from group 1.
    # Because my group 1 was `(delete:[\s\S]*?responses:\s*)` and then `\1        "200":`
    # So if group 1 ends with `responses:\n      `, it appended `        "200":` making it 14 spaces!
    
    # Let's fix it by standardizing the indentation. We can just restore the git file, and do it safely.
    pass

fix_yaml()
