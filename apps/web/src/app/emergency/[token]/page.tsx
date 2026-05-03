"use client";

import { useQuery } from "convex/react";
import { api } from "@keeplas/backend/_generated/api";
import { useParams } from "next/navigation";
import { Loader, RichTextEditor } from "@keeplas/ui";
import { isRichTextEmpty } from "@/app/(dashboard)/emergency-card/sections/constants";

export default function PublicEmergencyPage() {
  const params = useParams<{ token: string }>();
  const card = useQuery(api.emergency_cards.getByQrToken, { token: params.token });

  if (card === undefined) {
    return <Loader fullscreen />;
  }

  if (card === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-on-surface-variant" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <h1 className="text-headline-md text-primary mb-2">
            Card Not Found
          </h1>
          <p className="text-body-lg text-on-surface-variant">
            This emergency card is no longer active or does not exist.
          </p>
        </div>
      </div>
    );
  }

  const hasAnyInfo =
    card.fullName ||
    card.bloodType ||
    !isRichTextEmpty(card.allergies) ||
    !isRichTextEmpty(card.medicalConditions) ||
    !isRichTextEmpty(card.medications) ||
    card.emergencyContactName ||
    !isRichTextEmpty(card.additionalNotes);

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="vault-gradient text-on-primary">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
              <svg className="w-5 h-5 text-on-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" />
              </svg>
            </div>
            <div>
              <span className="text-label-md opacity-70">
                Keeplas Emergency Card
              </span>
            </div>
          </div>

          {card.fullName && (
            <h1 className="text-display-lg mb-2">
              {card.fullName}
            </h1>
          )}

          <div className="flex items-center gap-2 mt-4">
            <div className="w-2 h-2 rounded-full bg-secondary-fixed animate-pulse" />
            <span className="text-body-md opacity-80">Active Protection</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-6 py-10">
        {hasAnyInfo ? (
          <div className="space-y-8">
            {/* Blood Type + Allergies */}
            {(card.bloodType || card.allergies) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {card.bloodType && (
                  <div className="bg-surface-container-low rounded-xl p-6">
                    <span className="text-label-md text-on-surface-variant block mb-2">
                      Blood Type
                    </span>
                    <p className="text-headline-md text-primary">
                      {card.bloodType}
                    </p>
                  </div>
                )}
                {!isRichTextEmpty(card.allergies) && (
                  <div className="bg-surface-container-low rounded-xl p-6">
                    <span className="text-label-md text-on-surface-variant block mb-2">
                      Allergies
                    </span>
                    <div className="text-headline-sm text-primary">
                      <RichTextEditor readOnly value={card.allergies ?? ""} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Medical Conditions */}
            {!isRichTextEmpty(card.medicalConditions) && (
              <div className="bg-surface-container-low rounded-xl p-6">
                <span className="text-label-md text-on-surface-variant block mb-2">
                  Medical Conditions
                </span>
                <div className="text-headline-sm text-primary">
                  <RichTextEditor
                    readOnly
                    value={card.medicalConditions ?? ""}
                  />
                </div>
              </div>
            )}

            {/* Medications */}
            {!isRichTextEmpty(card.medications) && (
              <div className="bg-surface-container-low rounded-xl p-6">
                <span className="text-label-md text-on-surface-variant block mb-2">
                  Current Medications
                </span>
                <div className="text-headline-sm text-primary">
                  <RichTextEditor readOnly value={card.medications ?? ""} />
                </div>
              </div>
            )}

            {/* Emergency Contact */}
            {card.emergencyContactName && (
              <div className="bg-primary-container rounded-xl p-6">
                <span className="text-label-md text-on-primary-container block mb-2">
                  Emergency Contact
                </span>
                <p className="text-headline-sm text-on-primary">
                  {card.emergencyContactName}
                  {card.emergencyContactRelation && (
                    <span className="text-body-md text-on-primary-container font-normal ml-2">
                      ({card.emergencyContactRelation})
                    </span>
                  )}
                </p>
                {card.emergencyContactPhone && (
                  <a
                    href={`tel:${card.emergencyContactPhone}`}
                    className="text-headline-sm text-secondary-fixed mt-1 block hover:underline"
                  >
                    {card.emergencyContactPhone}
                  </a>
                )}
              </div>
            )}

            {/* Additional Notes */}
            {!isRichTextEmpty(card.additionalNotes) && (
              <div className="bg-surface-container-low rounded-xl p-6">
                <span className="text-label-md text-on-surface-variant block mb-2">
                  Additional Notes
                </span>
                <div className="text-body-lg text-on-surface">
                  <RichTextEditor
                    readOnly
                    value={card.additionalNotes ?? ""}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-on-surface-variant">
            <p className="text-body-lg">No emergency information has been shared on this card.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto px-6 py-8 text-center">
        <p className="text-label-md text-on-surface-variant">
          Last updated: {new Date(card.updatedAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
        <p className="text-label-md text-on-surface-variant mt-2">
          Powered by Keeplas — Life Continuity Platform
        </p>
      </footer>
    </div>
  );
}
