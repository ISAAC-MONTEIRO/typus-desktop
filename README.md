# TYPUS Desktop (Windows)

Cliente desktop do TYPUS: abre `https://typus-shark.duckdns.org/` numa janela própria, com ícone
na bandeja, badge de notificações, inicialização com o Windows e atualização automática.

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
# -> out/make/squirrel.windows/x64/TYPUS-Setup.exe
```

## Lançar uma versão (atualização automática)

> Antes da primeira versão: crie o repositório `ISAAC-MONTEIRO/typus-desktop` no GitHub e
> adicione-o como `origin` (`git remote add origin https://github.com/ISAAC-MONTEIRO/typus-desktop.git`).
> Hoje este clone só tem o `upstream` do projeto de origem.

1. Suba `version` no `package.json` (ex.: `1.0.1`), faça commit.
2. `git tag v1.0.1 && git push origin main v1.0.1`
3. O workflow `Release Windows` gera o instalador e cria uma release **rascunho** no GitHub.
4. Publique o rascunho. Os apps instalados baixam a atualização sozinhos
   (via update.electronjs.org, que exige o repositório público).

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
