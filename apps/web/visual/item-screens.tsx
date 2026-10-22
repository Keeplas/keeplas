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
