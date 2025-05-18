import { NextResponse } from "next/server";


export async function POST(request: Request) {
  try {
    // Obter o valor da doação do corpo da requisição
    const {amount = 1 } = await request.json()

    //Simular atraso de processamento
    await new Promise((resolve) => setTimeout(resolve, 5000))

    // Em produção, aqui vamos integrar uma api de pagamento PIX 
    // Mercado Pago, PagSeguro ou outra qualquer.
    //


  // Dados simulador de retorno
  

  const pixData = {
      qrCOdeImage: "/placeholder.svg?height=300&width300", //Em produção URL real ou base64
      copyPasteCode:
      "000201265BR.GOV.BR.BCB.PIX136example@email.com"
      expiresAt: new Date(Date.now() +30 *60 * 1000).toISOString(), //30 minutos
      transactionId: `PIX${Date.now()}${Math.floor(Math.random() * 1000)}`,
    }

    return NextResponse.json(pixData)

  } catch (error) {
    console.log("Erro ao gerar Pix", error)
    return NextResponse.json({error: "Erro ao gerar código PIX"}, {status: 500})
  }
}
