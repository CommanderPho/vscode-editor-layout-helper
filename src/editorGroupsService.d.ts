// From https://github.com/microsoft/vscode/blob/7d084eeca8d27d442b62506ea06f9d444ed28eae/src/vs/workbench/services/editor/common/editorGroupsService.ts

export const enum GroupOrientation {
	HORIZONTAL,
	VERTICAL
}

export interface GroupLayoutArgument {
	/**
	 * Only applies when there are multiple groups
	 * arranged next to each other in a row or column.
	 * If provided, their sum must be 1 to be applied
	 * per row or column.
	 */
	size?: number;

	/**
	 * Editor groups  will be laid out orthogonal to the
	 * parent orientation.
	 */
	groups?: GroupLayoutArgument[];
}

interface EditorGroupLayout {
	/**
	 * The initial orientation of the editor groups at the root.
	 */
	orientation: GroupOrientation;

	/**
	 * The editor groups at the root of the layout.
	 */
	groups: GroupLayoutArgument[];
}
