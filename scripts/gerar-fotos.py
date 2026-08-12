"""Gera as fotos publicadas em public/fotos/ a partir dos originais em fotos/.

O MANIFESTO abaixo é a fonte da verdade da seleção: cada linha liga o número
do arquivo original (IMG_1234) ao nome publicado. Rode de novo sempre que a
seleção mudar — o que não estiver no manifesto é apagado de public/fotos/,
com exceção de hero.jpg, que é a foto de capa.

    python3 scripts/gerar-fotos.py

Saída: 1600px no maior lado, JPEG qualidade 80, progressivo e sem EXIF.
Depois de rodar, atualize as entradas em src/lib/fotos.ts.
"""

import glob
import os
import sys

from PIL import Image, ImageOps

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, "public/fotos")
LARGURA_MAX = 1600
QUALIDADE = 80

# (número do IMG original, nome do arquivo publicado)
MANIFESTO = [
    # ---- Piscina ----
    (7537, "piscina-vista-geral"),
    (5502, "piscina-comprimento"),
    (7535, "piscina-mureta"),
    (5561, "piscina-quiosques"),
    (7510, "piscina-cascata-01"),
    (7511, "piscina-cascata-02"),
    (5506, "piscina-cascata-jardim"),
    (5499, "piscina-espreguicadeiras"),
    # ---- Churrasqueira ----
    (5490, "gourmet-churrasqueira-arcos"),
    (7534, "gourmet-quiosque-arcos"),
    (5494, "gourmet-churrasqueira-fogao"),
    (5574, "gourmet-quiosques-piscina"),
    # ---- Bar e quiosques ----
    (5514, "bar-quiosque-redondo"),
    (5516, "bar-balcao-madeira"),
    (5517, "bar-vista-piscina"),
    # ---- Mesa de sinuca ----
    (5518, "sinuca-jardim"),
    (5567, "sinuca-piscina"),
    # ---- Salão de festas ----
    (5457, "salao-mesas"),
    (7517, "salao-luz-natural"),
    (5459, "salao-cadeiras"),
    (5461, "salao-fogao-industrial"),
    # ---- A casa por fora ----
    (5552, "casa-fachada"),
    (7519, "casa-madeira-vidro"),
    (5556, "casa-varanda"),
    (7533, "casa-caminho-pedra"),
    # ---- Jardim ----
    (5470, "jardim-quiosque-balanco"),
    (5483, "jardim-balanco"),
    (5480, "jardim-alameda"),
    (7513, "jardim-arvores"),
    (5559, "jardim-vista-piscina"),
    # ---- Quadra ----
    (5474, "quadra-casa"),
    (7530, "quadra-vista-geral"),
    # ---- Sala de estar do 1º andar ----
    (5543, "sala-estar-1-escada"),
    (5544, "sala-estar-1-sofas"),
    # ---- Sala de estar do 2º andar ----
    (7526, "sala-estar-2-vista"),
    (7520, "sala-estar-2-mezanino"),
    (5426, "sala-estar-2-bar"),
    # ---- Sala de jantar ----
    (5449, "sala-jantar-mesa"),
    (5447, "sala-jantar-varanda"),
    # ---- Cozinha ----
    (5443, "cozinha-geral"),
    (5446, "cozinha-bancada"),
    # ---- Suíte ----
    (7524, "suite-cama"),
    (5437, "suite-vista"),
    (5436, "suite-camas"),
    # ---- Quartos ----
    (5418, "quarto-1"),
    (5419, "quarto-2"),
    (5420, "quarto-3"),
    (5452, "quarto-4"),
    (5450, "quarto-4-triliches"),
    (5456, "quarto-5"),
    # ---- Banheiro da suíte ----
    (7525, "hidromassagem-01"),
    (5439, "hidromassagem-02"),
    # ---- Banheiros e vestiários ----
    (5421, "banheiro-1-pia"),
    (5423, "banheiro-1-box"),
    (5454, "banheiro-2"),
    (5463, "vestiario-armarios"),
    (5465, "vestiario-banco"),
]


def original(numero: int) -> str:
    achados = glob.glob(os.path.join(RAIZ, f"fotos/*/IMG_{numero}.*"))
    if not achados:
        raise SystemExit(f"IMG_{numero} não encontrado em fotos/")
    return achados[0]


def main() -> None:
    nomes = [nome for _, nome in MANIFESTO]
    if len(set(nomes)) != len(nomes):
        raise SystemExit("há nomes repetidos no MANIFESTO")

    os.makedirs(SAIDA, exist_ok=True)
    for numero, nome in MANIFESTO:
        img = ImageOps.exif_transpose(Image.open(original(numero))).convert("RGB")
        img = ImageOps.contain(img, (LARGURA_MAX, LARGURA_MAX), Image.LANCZOS)
        destino = os.path.join(SAIDA, f"{nome}.jpg")
        img.save(destino, "JPEG", quality=QUALIDADE, optimize=True, progressive=True)
        print(
            f"{nome}.jpg  {img.width}x{img.height}  "
            f"{os.path.getsize(destino) // 1024} kB  (IMG_{numero})"
        )

    # Limpa o que sobrou da seleção antiga — hero.jpg fica, é usado na capa.
    mantidos = {f"{nome}.jpg" for nome in nomes} | {"hero.jpg"}
    for arquivo in sorted(os.listdir(SAIDA)):
        if arquivo not in mantidos:
            os.remove(os.path.join(SAIDA, arquivo))
            print(f"removido: {arquivo}", file=sys.stderr)

    print(f"\n{len(MANIFESTO)} fotos publicadas em public/fotos/")


if __name__ == "__main__":
    main()
