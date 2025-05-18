import { NextResponse } from "next/server";

export async function GET() {
  try {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const stats = {
      totalDonations: 0,
      goalAmount: 10000,
      percentComplete: (0 / 10000) * 100,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("erro ao buscar estatísticas:", error);
    return NextResponse.json(
      { error: "Erro ao buscar estatísticas" },
      { status: 500 },
    );
  }
}
