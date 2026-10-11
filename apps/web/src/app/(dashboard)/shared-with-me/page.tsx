import { Loader } from "@keeplas/ui";
import { SharedVaultList } from "./shared-vault-list";
import { SharedWithMeView } from "./shared-with-me-view";
import { useSharedFolders } from "./use-shared-folders";

export default function SharedWithMePage() {
  const { folders, download } = useSharedFolders();
  if (!folders) return <Loader />;
  return (
    <SharedWithMeView
      folders={folders}
      onDownload={(folderId, fileId) => void download(folderId, fileId)}
      footer={<SharedVaultList />}
    />
  );
}
