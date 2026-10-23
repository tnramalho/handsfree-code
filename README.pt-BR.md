# handsfree-code

**Converse com o Claude Code por voz quando você não pode olhar a tela.** Você fala, ele
trabalha no seu repositório e responde em voz alta: curto, direto e dá pra interromper. Feito
pra dirigir, cozinhar, passear com o cachorro, ou qualquer momento em que as mãos e os olhos
estão ocupados.

> English: [README.md](README.md)

```text
Você:  James, cria uma branch pra corrigir a versão do Node e roda os testes.
James: Ok, tô nisso.
       ...
James: Branch criada, Node atualizado nas duas imagens, 40 testes passando. Faço o commit?
Você:  (conversando com alguém no carro)   ← ignorado: você não disse "James"
Você:  James, faz o commit e o push.
James: Antes de seguir: vou enviar commits pro repositório remoto. Pra seguir, me chame e diga confirma.
Você:  James, confirma.
```

## O que ele faz

- **Nome pra chamar.** Ouve o tempo todo, mas só age quando você chama pelo nome (padrão
  `James`). Conversa com outra pessoa é ignorada.
- **Confirmação falada pra ações pesadas.** Funciona como o Claude Code com as permissões
  puladas, exceto que `git push`, PR, deploy, publicar, `sudo`, servidor remoto e apagar ou
  alterar arquivos fora do projeto esperam você dizer o nome + "confirma".
- **Dá pra interromper.** "James, para" corta a fala e a tarefa, mesmo no meio da frase
  (no meio da frase precisa da chave OpenAI; sem ela, ele te ouve quando termina a frase).
- **Respostas curtas.** No máximo duas frases faladas, e a pergunta final nunca é cortada.
- **Continua de onde você parou.** Começa por um arquivo de handoff ou por uma sessão do Claude
  Code que já existe.
- **Worktrees.** Trabalha numa cópia separada da branch sem mexer na sua pasta principal.

## Requisitos

- macOS (usa o áudio do sistema e o `say`). Linux está no [roadmap](ROADMAP.md).
- Node.js 22+ e `ffmpeg` (`brew install ffmpeg`).
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) instalado e logado. Roda no seu
  plano do Claude ou na sua chave de API.
- Recomendado: uma chave da OpenAI pra voz natural e transcrição em ~1 s. Sem ela, usa a voz do
  macOS e um Whisper local (grátis, mais lento).

## Instalar

```bash
git clone https://github.com/tnramalho/handsfree-code.git
cd handsfree-code
npm install
npm run build
npm link
```

Opcional, a transcrição local grátis (reserva):

```bash
python3 -m venv ~/.handsfree-code/venv
~/.handsfree-code/venv/bin/pip install faster-whisper
```

Opcional, chaves e preferências em `~/.config/handsfree-code/config.env` (veja
[examples/config.env.example](examples/config.env.example)). Nunca coloque esse arquivo num
repositório.

```bash
mkdir -p ~/.config/handsfree-code
cp examples/config.env.example ~/.config/handsfree-code/config.env
chmod 600 ~/.config/handsfree-code/config.env
```

Na primeira vez o macOS pede permissão de microfone pro seu terminal.

## Usar

```bash
cd caminho/do/projeto
handsfree
```

| Comando | O que faz |
|---|---|
| `handsfree` | Começa na pasta atual. |
| `handsfree -w fix/login` | Cria ou reaproveita um worktree da `fix/login` e trabalha nele. |
| `handsfree --handoff notas/handoff.md` | Lê o handoff e diz onde vocês estão. |
| `handsfree --continuar` | Continua a sessão mais recente do Claude Code nesta pasta (numa cópia). |
| `handsfree --sessao <id>` | Continua uma sessão específica (numa cópia). |
| `handsfree --nome Ana` | Usa outro nome. |
| `handsfree --mic` | Medidor de volume do microfone. |

`voz` é um atalho pra `handsfree`.

### O que falar

| Fale | Resultado |
|---|---|
| "James" | Bipe, "Opa, diga." e a próxima frase vale como pra ele (entra na fila se estiver ocupado). |
| "James, roda os testes" | Faz. |
| (logo depois de uma pergunta dele) "pode sim" | Até 20 s depois que ele termina, dá pra responder sem o nome. |
| "James, para" | Para de falar e para a tarefa. Funciona no meio da frase com a chave OpenAI. |
| "James" enquanto ele fala | Corta a fala, diz "Opa, diga." e ouve o pedido inteiro. |
| "James, confirma" / "James, não" | Responde a uma confirmação de ação pesada. |
| "James, abre o worktree da branch X" | Troca pra esse worktree. |
| "James, tchau" | Encerra. |

Pedido feito enquanto ele trabalha entra na fila.

## Saiba mais

- [Casos de uso e exemplos](docs/use-cases.md)
- [Como funciona](docs/architecture.md)
- [Configuração](docs/configuration.md)
- [Modelo de segurança e limites](docs/safety.md). Leia antes de usar num repositório importante.
- [Problemas comuns](docs/troubleshooting.md)
- [Roadmap](ROADMAP.md) · [Como contribuir](CONTRIBUTING.md) · [Segurança](SECURITY.md)

## Aviso

Projeto independente, sem vínculo, endosso ou patrocínio da Anthropic ou da OpenAI. "Claude" e
"Claude Code" são marcas da Anthropic, citadas só pra descrever com o que a ferramenta funciona.

Não mexa em tela dirigindo. A ferramenta foi feita pra você nunca precisar olhar, mas a atenção
na estrada vem primeiro.

## Licença

[MIT](LICENSE)
