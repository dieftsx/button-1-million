import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const amount = Number(body?.amount ?? 1);

    if (!Number.isFinite(amount) || amount < 1 || amount > 10000) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }

    // Simula latência do provedor de pagamento
    await new Promise((resolve) => setTimeout(resolve, 700));

    // Em produção, integrar um PSP (Mercado Pago, PagSeguro, etc.) e retornar
    // o QR Code e o "copia e cola" reais.
    const pixData = {
      copyPasteCode: `00020126580014BR.GOV.BCB.PIX0136demo@1million.app5204000053039865406${amount.toFixed(2)}5802BR59091 MILLION6009SAO PAULO62070503***6304DEMO`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
      transactionId: `PIX${Date.now()}${Math.floor(Math.random() * 1000)}`,
    };

    return NextResponse.json(pixData);
  } catch (error) {
    console.error("Erro ao gerar Pix", error);
    return NextResponse.json(
      { error: "Erro ao gerar código PIX" },
      { status: 500 },
    );
  }
}
