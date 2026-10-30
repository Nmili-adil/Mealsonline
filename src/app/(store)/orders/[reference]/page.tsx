import type { Metadata } from "next";
import { OrderTracker } from "@/components/orders/OrderTracker";

export const metadata: Metadata = {
  title: "Suivi de commande",
  description: "Suivez votre commande MealsOnline en temps réel.",
};

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  return (
    <div className="page-width">
      <OrderTracker reference={decodeURIComponent(reference)} />
    </div>
  );
}
