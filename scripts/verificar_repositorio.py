"""Pré-verificação de arquivos sensíveis no repositório público do SGM.

Execute: python scripts/verificar_repositorio.py
Uma aprovação humana e testes de autorização continuam obrigatórios.
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SKIP = {'.git', 'node_modules', '.venv', '__pycache__'}
TEXT = {'.html', '.js', '.json', '.txt', '.md', '.py', '.sql', '.css', '.yml', '.yaml'}
FORBIDDEN = {'.env', '.env.production', '.env.local'}
PATTERNS = [
    (re.compile(r'(?is)<script\\b[^>]*\\bid=["\\\']data["\\\'][^>]*>\\s*\\{\\s*["\\\']rows["\\\']\\s*:\\s*\\[\\s*\\{'), 'JSON de OS incorporado'),
    (re.compile(r'\\bsb_secret_[A-Za-z0-9_-]{10,}\\b'), 'chave secreta Supabase'),
    (re.compile(r'\\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\\b'), 'token GitHub'),
    (re.compile(r'(?i)-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'), 'chave PEM privada'),
]

def main():
    errors, checked = [], 0
    for path in ROOT.rglob('*'):
        if not path.is_file() or any(part in SKIP for part in path.relative_to(ROOT).parts):
            continue
        relative = path.relative_to(ROOT)
        if path.name in FORBIDDEN or any(part in {'private', 'dados_privados', 'bases', 'backups', 'exports'} for part in relative.parts):
            errors.append(f'{relative}: arquivo privado')
            continue
        if path.suffix.lower() not in TEXT:
            continue
        checked += 1
        if path.suffix.lower() in {'.html', '.json', '.js'} and path.stat().st_size > 2_000_000:
            errors.append(f'{relative}: verificar conteúdo de arquivo grande')
            continue
        content = path.read_text(encoding='utf-8', errors='replace')
        for pat, title in PATTERNS:
            if pat.search(content):
                errors.append(f'{relative}: {title}')
    if errors:
        print('PUBLICAÇÃO BLOQUEADA:')
        for error in errors:
            print(' -', error)
        return 1
    print(f'Pré-verificação concluída em {checked} arquivos; revisão manual ainda necessária.')
    return 0

if __name__ == '__main__':
    sys.exit(main())
