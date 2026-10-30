"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { CheckCircle, ArrowRight } from "@phosphor-icons/react";
import {
  useCartStore,
  cartSubtotalMinor,
  cartLinesToPayload,
} from "@/store/cart-store";
import { formatMAD } from "@/lib/money";
import { normalizePhone } from "@/lib/validation/schemas";

const checkoutFormSchema = z.object({
  fulfillmentType: z.enum(["delivery", "pickup"]),
  customerName: z.string().min(2, "Nom trop court").max(100),
  phone: z
    .string()
    .min(1, "Téléphone requis")
    .refine((value) => /^\+?212[5-7]\d{8}$|^0[5-7]\d{8}$/.test(normalizePhone(value)), {
      message: "Numéro marocain invalide",
    }),
  deliveryAddress: z.string().max(500).optional(),
  deliveryInstructions: z.string().max(300).optional(),
  orderNote: z.string().max(300).optional(),
  paymentMethod: z.enum(["cash_on_delivery", "pay_at_pickup"]),
});

type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;

interface ServerQuote {
  subtotal: number;
  deliveryFee: number;
  total: number;
  priceChanged: boolean;
}

export function CheckoutForm() {
  const lines = useCartStore((state) => state.lines);
  const clearCart = useCartStore((state) => state.clearCart);
  const [quote, setQuote] = useState<ServerQuote | null>(null);
  const [approveChange, setApproveChange] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ reference: string; token: string } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: {
      fulfillmentType: "delivery",
      customerName: "",
      phone: "",
      deliveryAddress: "",
      deliveryInstructions: "",
      orderNote: "",
      paymentMethod: "cash_on_delivery",
    },
  });

  const fulfillmentType = watch("fulfillmentType");
  const clientSubtotal = cartSubtotalMinor(lines);

  const onSubmit = async (values: CheckoutFormValues) => {
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        phone: normalizePhone(values.phone),
        items: cartLinesToPayload(lines),
      };

      const validateResponse = await fetch("/api/checkout/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const validateData = await validateResponse.json();

      if (!validateResponse.ok || !validateData.ok) {
        setError(validateData.message ?? "Impossible de valider le panier.");
        setSubmitting(false);
        return;
      }

      const serverQuote: ServerQuote = {
        subtotal: validateData.subtotal,
        deliveryFee: validateData.deliveryFee,
        total: validateData.total,
        priceChanged: validateData.priceChanged,
      };
      setQuote(serverQuote);

      if (serverQuote.priceChanged && !approveChange) {
        setSubmitting(false);
        return;
      }

      const submitResponse = await fetch("/api/checkout/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...payload,
          approvedTotal: serverQuote.total,
          approvePriceChange: approveChange || !serverQuote.priceChanged,
        }),
      });
      const submitData = await submitResponse.json();

      if (!submitResponse.ok || !submitData.ok) {
        setError(submitData.message ?? "Impossible de créer la commande.");
        setSubmitting(false);
        return;
      }

      clearCart();
      sessionStorage.setItem(`mlo_tracking_${submitData.reference}`, submitData.trackingToken);
      setSuccess({ reference: submitData.reference, token: submitData.trackingToken });
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="order-track">
        <div className="admin-card" style={{ textAlign: "center", padding: 40 }}>
          <CheckCircle size={52} weight="fill" color="var(--green)" aria-hidden="true" />
          <h1 style={{ margin: "18px 0 10px", fontSize: 26 }}>Commande transmise</h1>
          <p style={{ color: "#a3aca6", lineHeight: 1.6, margin: "0 0 20px" }}>
            Votre commande <strong style={{ color: "#f7f9f7" }}>{success.reference}</strong> a
            été enregistrée et transmise au restaurant. Elle sera confirmée par le point de
            vente dans quelques instants — aucun paiement n'est exigé avant acceptation.
          </p>
          <p style={{ color: "#f2bd4d", fontSize: 13, lineHeight: 1.6, margin: "0 0 22px" }}>
            Conservez votre référence et votre jeton de suivi. Le jeton est stocké sur cet
            appareil ; notez-le si vous souhaitez suivre la commande ailleurs :{" "}
            <code style={{ wordBreak: "break-all" }}>{success.token}</code>
          </p>
          <Link href={`/orders/${success.reference}`} className="button">
            Suivre ma commande <ArrowRight weight="bold" aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="empty-state">
        <h3>Votre panier est vide</h3>
        <p>Ajoutez des produits avant de passer commande.</p>
        <Link href="/menu" className="button button-compact" style={{ marginTop: 16 }}>
          Voir le menu
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="checkout-layout">
      <div>
        <div className="admin-card" style={{ marginBottom: 18 }}>
          <h3>Mode de commande</h3>
          <div className="radio-cards">
            <label className="radio-card" aria-pressed={fulfillmentType === "delivery"}>
              <input type="radio" value="delivery" {...register("fulfillmentType")} />
              Livraison
            </label>
            <label className="radio-card" aria-pressed={fulfillmentType === "pickup"}>
              <input type="radio" value="pickup" {...register("fulfillmentType")} />
              Retrait au restaurant
            </label>
          </div>
        </div>

        <div className="admin-card" style={{ marginBottom: 18 }}>
          <h3>Vos informations</h3>
          <div className="form-grid">
            <div className="form-row">
              <div className="field">
                <label htmlFor="customerName">Nom complet</label>
                <input id="customerName" {...register("customerName")} placeholder="Votre nom" />
                {errors.customerName ? <span className="field-error">{errors.customerName.message}</span> : null}
              </div>
              <div className="field">
                <label htmlFor="phone">Téléphone</label>
                <input id="phone" {...register("phone")} placeholder="+212 6 12 34 56 78" inputMode="tel" />
                {errors.phone ? <span className="field-error">{errors.phone.message}</span> : null}
              </div>
            </div>

            {fulfillmentType === "delivery" ? (
              <>
                <div className="field">
                  <label htmlFor="deliveryAddress">Adresse de livraison</label>
                  <input id="deliveryAddress" {...register("deliveryAddress")} placeholder="Rue, quartier, ville" />
                  {errors.deliveryAddress ? <span className="field-error">{errors.deliveryAddress.message}</span> : null}
                </div>
                <div className="field">
                  <label htmlFor="deliveryInstructions">Instructions de livraison (facultatif)</label>
                  <textarea id="deliveryInstructions" {...register("deliveryInstructions")} placeholder="Digicode, étage…" />
                </div>
              </>
            ) : null}

            <div className="field">
              <label htmlFor="orderNote">Note pour le restaurant (facultatif)</label>
              <textarea id="orderNote" {...register("orderNote")} placeholder="Toute précision utile" />
            </div>
          </div>
        </div>

        <div className="admin-card">
          <h3>Paiement</h3>
          <div className="radio-cards">
            <label className="radio-card" aria-pressed={watch("paymentMethod") === "cash_on_delivery"}>
              <input type="radio" value="cash_on_delivery" {...register("paymentMethod")} />
              Espèces à la livraison
            </label>
            <label className="radio-card" aria-pressed={watch("paymentMethod") === "pay_at_pickup"}>
              <input type="radio" value="pay_at_pickup" {...register("paymentMethod")} />
              Payer au retrait
            </label>
          </div>
        </div>
      </div>

      <aside className="summary-card">
        <h3>Récapitulatif</h3>
        {lines.map((line) => (
          <div className="summary-line" key={line.lineId}>
            <span>
              {line.quantity}× {line.productName} ({line.variantName})
            </span>
            <strong>{formatMAD(line.unitPrice * line.quantity)}</strong>
          </div>
        ))}
        <div className="summary-divider" />
        <div className="summary-line">
          <span>Sous-total estimé</span>
          <strong>{formatMAD(clientSubtotal)}</strong>
        </div>
        {quote ? (
          <>
            <div className="summary-line">
              <span>Frais de livraison</span>
              <strong>{formatMAD(quote.deliveryFee)}</strong>
            </div>
            <div className="summary-divider" />
            <div className="summary-total">
              <span>Total validé</span>
              <span>{formatMAD(quote.total)}</span>
            </div>
          </>
        ) : null}

        {quote?.priceChanged ? (
          <div className="price-change-banner">
            <strong>Le total a changé.</strong> Les prix ont été mis à jour par le restaurant.
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={approveChange}
                onChange={(event) => setApproveChange(event.target.checked)}
                style={{ accentColor: "var(--green)" }}
              />
              J'accepte le nouveau total de {formatMAD(quote.total)}
            </label>
          </div>
        ) : null}

        {error ? (
          <p className="field-error" style={{ margin: "12px 0 0" }}>{error}</p>
        ) : null}

        <button
          type="submit"
          className="button"
          style={{ width: "100%", marginTop: 16 }}
          disabled={submitting || (quote?.priceChanged === true && !approveChange)}
        >
          {submitting
            ? "Validation…"
            : quote?.priceChanged
              ? "Confirmer le nouveau total"
              : "Valider ma commande"}
        </button>
        <p style={{ margin: "10px 0 0", color: "#a3aca6", fontSize: 12 }}>
          La commande est transmise au restaurant pour acceptation. Aucun paiement en ligne.
        </p>
      </aside>
    </form>
  );
}
