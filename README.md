# TYPUS Desktop (Windows, macOS e Linux)

Cliente desktop do TYPUS: abre `https://typus-shark.duckdns.org/` numa janela própria, com ícone
na bandeja, badge de notificações, inicialização com o sistema e atualização automática
(Windows; no macOS ela exige o app assinado, no Linux instale o `.deb` novo).

| Sistema | Instalador |
|---|---|
| Windows x64 | `TYPUS-Setup.exe` (e `.zip`) |
| macOS (Apple Silicon e Intel) | `TYPUS.dmg` (e `.zip`) |
| Linux x64 | `typus-desktop_<versão>_amd64.deb` (e `.zip`) |

## Rodar localmente

```bash
pnpm install
pnpm start
# apontando para outro servidor (ex.: o frontend de desenvolvimento):
pnpm start --force-server=http://localhost:5201
```

## Gerar o instalador localmente

```bash
pnpm install
pnpm make
# Windows -> out/make/squirrel.windows/x64/TYPUS-Setup.exe
```

Cada sistema gera só os seus instaladores (o `.dmg` precisa de um Mac, o `.deb` de um Linux
com `fakeroot`). Para gerar os três sem ter as máquinas, use o GitHub Actions (abaixo).

## Testar os instaladores sem publicar

Em **Actions > Release > Run workflow**, escolha a branch e rode. Os instaladores de todos
os sistemas ficam em **Artifacts** da execução; nenhuma release é criada.

## Lançar uma versão (atualização automática)

1. Suba `version` no `package.json` (ex.: `1.0.1`), faça commit.
2. `git tag v1.0.1 && git push origin main v1.0.1`
3. O workflow `Release` cria **uma** release rascunho e cada sistema anexa os seus instaladores.
4. Publique o rascunho. Os apps instalados no Windows baixam a atualização sozinhos
   (via update.electronjs.org, que exige o repositório público).

## macOS sem assinatura

Sem uma conta Apple Developer, o app sai sem assinatura e o macOS bloqueia a primeira
abertura. Para abrir: clique com o botão direito no TYPUS em Aplicativos > **Abrir** (ou
Ajustes do Sistema > Privacidade e Segurança > **Abrir Mesmo Assim**).

Link fixo para enviar às pessoas:
`https://github.com/ISAAC-MONTEIRO/typus-desktop/releases/latest/download/TYPUS-Setup.exe`

## Assinatura de código

Sem certificado, o Windows mostra o aviso do SmartScreen e, em máquinas com
**Smart App Control** ligado, bloqueia o app. Para assinar, configure os secrets do repositório:

| Secret | Uso |
|---|---|
| `WINDOWS_CERTIFICATE_BASE64` + `WINDOWS_CERTIFICATE_PASSWORD` | certificado `.pfx` em base64 |
| `WINDOWS_SIGN_PARAMS` | parâmetros extras do `signtool` (certificado em nuvem, ex.: Azure Artifact Signing) |

## Licença

AGPL-3.0 — veja [LICENSE](LICENSE) e [NOTICE](NOTICE). TYPUS é baseado no Stoat (AGPL-3.0).
