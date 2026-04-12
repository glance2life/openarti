import {
  getIconForFilePath,
  getIconForDirectoryPath,
} from "vscode-material-icons";

const ICONS_BASE_PATH = "/file-icons";

export function getFileIconUrl(filename: string, isDirectory = false): string {
  const iconName = isDirectory
    ? getIconForDirectoryPath(filename)
    : getIconForFilePath(filename);
  return `${ICONS_BASE_PATH}/${iconName}.svg`;
}

export function FileIcon({
  filename,
  isDirectory = false,
  className = "size-4 shrink-0",
}: {
  filename: string;
  isDirectory?: boolean;
  className?: string;
}) {
  const src = getFileIconUrl(filename, isDirectory);
  return (
    <img
      src={src}
      alt=""
      className={className}
      draggable={false}
    />
  );
}
