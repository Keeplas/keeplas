import type { ReactNode } from "react";
import { ItemLayout } from "@/app/(dashboard)/vault/[itemId]/item-layout";
import {
  DetailRow,
  DetailsPanel,
  type ActivityEntry,
} from "@/components/vault/details-panel";
import { DocumentPages } from "@/components/vault/preview/document-pages";
import {
  MediaPlayer,
  StreamNote,
} from "@/components/vault/preview/media-player";
import {
  Pager,
  PreviewPanel,
  ToolbarButton,
  ZoomControl,
} from "@/components/vault/preview/preview-panel";
import { PhotoGallery } from "@/components/vault/preview/photo-gallery";
import { ICON_PATHS } from "@/lib/icons";
import page1 from "./fixtures/policy-page-1.png";
import thumb1 from "./fixtures/policy-thumb-1.png";
import thumb2 from "./fixtures/policy-thumb-2.png";
import thumb3 from "./fixtures/policy-thumb-3.png";
import desktopLandscape from "../../../PRD/v2-mobile-first/figma/svg/illustrations/desktop-landscape.svg";
import desktopLandscapeNight from "../../../PRD/v2-mobile-first/figma/svg/illustrations/desktop-landscape-night.svg";
import familyLake from "../../../PRD/v2-mobile-first/figma/svg/illustrations/web-family-lake.svg";
import landscape from "../../../PRD/v2-mobile-first/figma/svg/illustrations/landscape.svg";
import landscapeNight from "../../../PRD/v2-mobile-first/figma/svg/illustrations/landscape-night.svg";
import videoPoster from "../../../PRD/v2-mobile-first/figma/svg/illustrations/web-video-poster.svg";
import { HubView } from "@/app/(dashboard)/hub/hub-view";
import { AddFileDialog } from "@/components/vault/add-file-dialog";
import {
  AccessField,
  Field,
  FolderField,
} from "@/components/vault/form-fields";
import { NoteEditor } from "@/components/vault/note-editor";
import { ScanView } from "@/components/vault/scan-dialog";
import { VoiceMeter, VoiceRecorderBody } from "@/components/vault/voice-dialog";
import { Modal } from "@/components/v2/modal";
import { Input } from "@keeplas/ui";
import { SecuringDialog } from "@/components/vault/securing-dialog";
import type { Id } from "@keeplas/backend/_generated/dataModel";
import { hub, noop } from "./fixtures";

// W06-2 / W06-8 / W06-9 as the item page composes them, with the Figma
// content: the policy pages and photos are user files, so the fixture
// renders them from the Figma frame and illustrations.

const ACTIVITY: ActivityEntry[] = [
  {
    id: "1",
    title: "Opened on Chrome on Mac",
    when: "Today, 10:12 AM",
    actor: "You",
  },
  {
    id: "2",
    title: "Protected and ready",
    when: "Apr 12, 2026, 9:43 AM",
    actor: "Keeplas",
  },
  {
    id: "3",
    title: "Secure copy uploaded",
    when: "Apr 12, 2026, 9:42 AM",
    actor: "Keeplas",
  },
  {
    id: "4",
    title: "Encrypted on device",
    when: "Apr 12, 2026, 9:41 AM",
    actor: "You",
  },
];

function Details({ category, access }: { category: string; access: string }) {
  return (
    <DetailsPanel
      onEdit={noop}
      onAddPeople={noop}
      activity={ACTIVITY}
      onSeeAll={noop}
      rows={
        <>
          <DetailRow
            icon={ICON_PATHS.document}
            label="Category"
            value={category}
          />
          <DetailRow icon={ICON_PATHS.folder} label="Folder" value="Family" />
          <DetailRow icon={ICON_PATHS.lock} label="Access" value={access} />
        </>
      }
    />
  );
}

function Screen({
  list,
  name,
  title,
  subtitle,
  start,
  tools,
  preview,
  category,
  access,
}: {
  list: string;
  name: string;
  title: string;
  subtitle: string;
  start: ReactNode;
  tools?: ReactNode;
  preview: ReactNode;
  category: string;
  access: string;
}) {
  return (
    <ItemLayout
      breadcrumb={[
        { label: "My vault", href: "/hub" },
        { label: list, href: "/vault" },
        { label: name },
      ]}
      title={title}
      subtitle={subtitle}
      onDownload={noop}
      onShare={noop}
      preview={
        <PreviewPanel
          start={start}
          tools={tools}
          hidden={false}
          onToggleHidden={noop}
          menu={null}
        >
          {preview}
        </PreviewPanel>
      }
      details={<Details category={category} access={access} />}
    />
  );
}

export const documentViewer = () => (
  <Screen
    list="Documents"
    name="Home insurance policy.pdf"
    title="Home insurance policy"
    subtitle="PDF · 3 pages · 2.4 MB · Added Apr 12, 2026"
    start={<Pager label="Page 1 of 3" onNext={noop} />}
    tools={<ZoomControl zoom={1} onZoom={noop} />}
    preview={
      <DocumentPages
        thumbnails={[thumb1, thumb2, thumb3]}
        current={0}
        onSelect={noop}
        page={{ src: page1, width: 470, height: 545 }}
        zoom={1}
      />
    }
    category="Insurance"
    access="Only you"
  />
);

export const photoPreview = () => (
  <Screen
    list="Photos"
    name="Spare keys location.jpg"
    title="Spare keys location"
    subtitle="Photo · JPG · 1.1 MB · 4032 × 3024 · Added Mar 30, 2026"
    start={<Pager label="Photo 2 of 6" onPrevious={noop} onNext={noop} />}
    tools={
      <>
        <ToolbarButton icon={ICON_PATHS.rotate} label="Rotate" onClick={noop} />
        <ZoomControl zoom={1} onZoom={noop} />
      </>
    }
    preview={
      <PhotoGallery
        photos={[
          desktopLandscape,
          familyLake,
          landscapeNight,
          landscape,
          desktopLandscapeNight,
          videoPoster,
        ]}
        current={1}
        onSelect={noop}
        rotation={0}
        zoom={1}
      />
    }
    category="Photos"
    access="Sarah"
  />
);

export const videoPreview = () => (
  <Screen
    list="Videos"
    name="Message for the kids.mp4"
    title="Message for the kids"
    subtitle="Video · MP4 · 48 MB · 2:15 · Added Feb 14, 2026"
    start={
      <span className="text-[13px] leading-[18px] font-medium text-text-body">
        Video · 2:15
      </span>
    }
    preview={
      <div className="flex flex-col gap-[16px]">
        <MediaPlayer
          kind="video"
          src={undefined}
          poster={videoPoster}
          durationSec={135}
        />
        <p className="text-[14px] leading-[21px] text-text-body">
          “Hi you two. If you are watching this, I want you to know where
          everything is and how proud I am of you…”
        </p>
        <StreamNote />
      </div>
    }
    category="Videos"
    access="Sarah"
  />
);

// W06-3 / W06-4 open over the dashboard, as Figma draws them.
const policy = new File(
  [new Uint8Array(Math.round(2.4 * 1024 * 1024))],
  "Home insurance policy.pdf",
  { type: "application/pdf" },
);
const FOLDERS = [
  { id: "family" as Id<"folders">, name: "Family", itemCount: 4, grants: [] },
];

export const addDocument = () => (
  <>
    <HubView {...hub} />
    <AddFileDialog
      open
      onOpenChange={noop}
      kind="document"
      initialFiles={[policy]}
      defaultCategory="insurance_policy"
      folders={FOLDERS}
      onSubmit={async () => {}}
    />
  </>
);

export const securingItem = () => (
  <>
    <HubView {...hub} />
    <SecuringDialog
      open
      file={{
        kind: "document",
        name: "Home insurance policy.pdf",
        detail: "PDF · 3 pages · 2.4 MB",
      }}
      progress={{ phase: "uploading", uploaded: 64, total: 100 }}
      onCancel={noop}
      onBackground={noop}
      onOpenItem={noop}
    />
  </>
);

// W06-5: Figma's checklist is note content; the fixture writes it as a list.
export const newNote = () => (
  <NoteEditor
    breadcrumb={[{ label: "My vault", href: "/hub" }, { label: "New note" }]}
    heading="New note"
    subtitle="Write instructions, attach files and choose who can see them."
    initial={{
      title: "Instructions for my family",
      note:
        "<p>If something happens to me, our home insurance is with Maple Mutual. The policy is attached below. Call Sarah first: she has the spare keys and knows where the safe box is.</p>" +
        "<ul><li>Call Sarah (555-0198)</li><li>Contact Laura Chen at Maple Mutual to open a claim</li><li>Pay the house account from Maple Bank until things are settled</li></ul>",
      category: "wishes",
      folderId: FOLDERS[0].id,
      contactIds: [],
    }}
    saved={[
      {
        id: "1" as Id<"vault_item_files">,
        kind: "document",
        name: "Home insurance policy.pdf",
        detail: "Scanned · 3 pages · 2.4 MB",
      },
      {
        id: "2" as Id<"vault_item_files">,
        kind: "image",
        name: "Spare keys location.jpg",
        detail: "Photo · 1.1 MB",
      },
      {
        id: "3" as Id<"vault_item_files">,
        kind: "audio",
        name: "Voice note",
        detail: "0:28 · Recorded in this browser",
      },
    ]}
    folders={FOLDERS}
    saving={null}
    onSave={noop}
    onCancel={noop}
    onScan={noop}
    onRecordVoice={async () => null}
  />
);

// W06-6 meter: Figma's 29 recorded bars (px) as levels.
const LEVELS = [
  10, 18, 26, 14, 34, 22, 40, 28, 16, 30, 44, 24, 12, 20, 36, 26, 18, 32, 14,
  22, 38, 28, 16, 24, 12, 30, 20, 14, 26,
].map((height) => (height - 6) / 38);

export const recordVoice = () => (
  <>
    <HubView {...hub} />
    <Modal
      open
      onOpenChange={noop}
      title="Record a voice note"
      description="Leave a message in your own voice for the people you trust."
      width="w-[580px]"
    >
      <VoiceRecorderBody
        meter={<VoiceMeter state="recording" elapsed={28} levels={LEVELS} />}
        fields={
          <>
            <Field label="Title">
              {(id) => (
                <Input
                  id={id}
                  variant="field"
                  value="Message for Sarah"
                  readOnly
                />
              )}
            </Field>
            <div className="grid gap-[16px] sm:grid-cols-2">
              <FolderField
                value={FOLDERS[0].id}
                onChange={noop}
                folders={FOLDERS}
              />
              <AccessField value={[]} onChange={noop} folder={FOLDERS[0]} />
            </div>
          </>
        }
        paused={false}
        onDiscard={noop}
        onReset={noop}
        onPause={noop}
        onSave={noop}
        saveLabel="Save voice note"
        busy={false}
      />
    </Modal>
  </>
);

export const scanWithPhone = () => (
  <>
    <HubView {...hub} />
    <Modal
      open
      onOpenChange={noop}
      title="Scan with your phone"
      description="Use your phone camera to capture paper documents. They appear here once they are secured."
      width="w-[640px]"
    >
      <ScanView
        qr="https://app.keeplas.com/capture#h=k57f3qa8w2c9e4r6t1y0u5i8o3p2"
        status="waiting"
        remainingMs={105_000}
        onRenew={noop}
        onUpload={noop}
        onCancel={noop}
      />
    </Modal>
  </>
);
