"use client";

import type { CardFormData, PrivacyToggles } from "./sections/constants";
import { QRCodeSVG } from "./qr-code-svg";

interface EmergencyCardPreviewProps {
  formData: CardFormData;
  toggles: PrivacyToggles;
  qrUrl: string | null;
}

export function EmergencyCardPreview({ formData, toggles, qrUrl }: EmergencyCardPreviewProps) {
  const hasAnyVisible = Object.values(toggles).some(Boolean);

  return (
    <div className="relative group max-w-md w-full print:max-w-none">
      {/* The Digital Card */}
      <div
        id="emergency-card-printable"
        className="bg-surface-container-lowest rounded-[2rem] overflow-hidden shadow-2xl ghost-border flex flex-col print:rounded-none print:shadow-none"
      >
        {/* Header / Identity */}
        <div className="vault-gradient p-8 text-on-primary">
          <div className="flex justify-between items-start mb-10">
            <div className="flex flex-col">
              <span className="text-label-md opacity-70 mb-1">
                Keeplas Identity
              </span>
              <h2 className="text-headline-md">
                {toggles.showFullName && formData.fullName
                  ? formData.fullName
                  : "Your Name"}
              </h2>
            </div>
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-on-primary text-headline-sm">
              {formData.fullName ? formData.fullName.charAt(0).toUpperCase() : "?"}
            </div>
          </div>
          <div>
            <span className="text-label-md opacity-60">Status</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-secondary-fixed animate-pulse" />
              <span className="text-body-md font-medium">Active Protection</span>
            </div>
          </div>
        </div>

        {/* Info Content */}
        <div className="p-8 flex-grow flex flex-col justify-between">
          {hasAnyVisible ? (
            <div className="space-y-6">
              {/* Blood Type + Allergies row */}
              {(toggles.showBloodType || toggles.showAllergies) && (
                <div className="grid grid-cols-2 gap-8">
                  {toggles.showBloodType && (
                    <div>
                      <span className="text-label-md text-on-surface-variant block mb-1">
                        Blood Type
                      </span>
                      <p className="text-headline-md text-primary">
                        {formData.bloodType || "—"}
                      </p>
                    </div>
                  )}
                  {toggles.showAllergies && (
                    <div>
                      <span className="text-label-md text-on-surface-variant block mb-1">
                        Allergies
                      </span>
                      <p className="text-headline-sm text-primary">
                        {formData.allergies || "None Recorded"}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Medical Conditions */}
              {toggles.showMedicalConditions && (
                <div>
                  <span className="text-label-md text-on-surface-variant block mb-1">
                    Medical Conditions
                  </span>
                  <p className="text-headline-sm text-primary">
                    {formData.medicalConditions || "None Recorded"}
                  </p>
                </div>
              )}

              {/* Medications */}
              {toggles.showMedications && (
                <div>
                  <span className="text-label-md text-on-surface-variant block mb-1">
                    Current Medications
                  </span>
                  <p className="text-headline-sm text-primary">
                    {formData.medications || "None"}
                  </p>
                </div>
              )}

              {/* Emergency Contact */}
              {toggles.showEmergencyContact && (
                <div>
                  <span className="text-label-md text-on-surface-variant block mb-1">
                    Emergency Contact
                  </span>
                  <p className="text-headline-sm text-primary">
                    {formData.emergencyContactName
                      ? `${formData.emergencyContactName}${formData.emergencyContactRelation ? ` (${formData.emergencyContactRelation})` : ""}`
                      : "Not Set"}
                  </p>
                  {formData.emergencyContactPhone && (
                    <p className="text-body-md text-secondary font-medium">
                      {formData.emergencyContactPhone}
                    </p>
                  )}
                </div>
              )}

              {/* Additional Notes */}
              {toggles.showAdditionalNotes && formData.additionalNotes && (
                <div>
                  <span className="text-label-md text-on-surface-variant block mb-1">
                    Notes
                  </span>
                  <p className="text-body-md text-on-surface">
                    {formData.additionalNotes}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-on-surface-variant">
              <p className="text-headline-sm mb-2">No fields visible</p>
              <p className="text-body-md">Toggle on privacy controls to display information on your card.</p>
            </div>
          )}

          {/* QR Section */}
          <div className="mt-10 flex flex-col items-center space-y-4">
            <div className="p-4 bg-surface-container rounded-2xl">
              {qrUrl ? (
                <QRCodeSVG value={qrUrl} size={128} />
              ) : (
                <div className="w-32 h-32 bg-surface-container-high rounded-lg flex items-center justify-center">
                  <span className="text-body-md text-on-surface-variant text-center px-2">
                    QR code will appear after saving
                  </span>
                </div>
              )}
            </div>
            <p className="text-label-md text-on-surface-variant text-center">
              Scan for Emergency Info<br />& Medical Directives
            </p>
          </div>
        </div>
      </div>

      {/* Decorative background card */}
      <div className="absolute -z-10 top-8 -right-8 w-full h-full bg-surface-container rounded-[2rem] rotate-3 hidden lg:block print:hidden" />
    </div>
  );
}
