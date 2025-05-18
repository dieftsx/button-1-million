import { NextResponse } from "next/server";

let totalDonations = 0;

export async function POST(request: Request) {
  try {
    const { transactionId, amount = 1 } = await request.json();

    if (!transactionId) {
      return NextResponse.json(
        { error: "ID da transação é obrigatório" },
        { status: 400 },
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 500));

    totalDonations += amount;

    return NextResponse.json({
      success: true,
      totalDonations,
      message: "Doação registrada com sucesso!",
    });
  } catch (error) {
    console.log("Erro ao registrar doação", error);
    return NextResponse.json(
      { error: "Erro ao registrar doação" },
      { status: 500 },
    );
  }
}
