"use client";

import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Color, TextStyle } from "@tiptap/extension-text-style";

const COLORS = [
  { label: "默认", value: "" },
  { label: "金色", value: "#ffd16b" },
  { label: "米白", value: "#fff1d5" },
  { label: "朱红", value: "#b83224" },
  { label: "深棕", value: "#3a2418" },
  { label: "白色", value: "#ffffff" },
] as const;

const btnBase =
  "rounded-md border px-2.5 py-1 text-[12px] font-bold transition disabled:opacity-40";
const btnIdle = "border-[#e4c69f] bg-[#fffaf3] text-[#5a241a] hover:bg-[#ffe6b8]";
const btnActive = "border-[#b83224] bg-[#b83224] text-white";

type Props = {
  value: string;
  onChange: (html: string) => void;
};

export default function RulesRichEditor({ value, onChange }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
        italic: false,
        link: false,
      }),
      TextStyle,
      Color,
    ],
    content: value || "<p></p>",
    editorProps: {
      attributes: {
        class:
          "min-h-[220px] max-h-[420px] overflow-y-auto px-3 py-2 text-[13px] font-normal leading-7 text-[#3a2418] outline-none [&_p]:m-0 [&_p+p]:mt-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5",
      },
    },
    onUpdate: ({ editor: current }) => {
      const html = current.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  const toolbar = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current) {
        return {
          bold: false,
          bullet: false,
          ordered: false,
          color: "",
        };
      }
      return {
        bold: current.isActive("bold"),
        bullet: current.isActive("bulletList"),
        ordered: current.isActive("orderedList"),
        color: String(current.getAttributes("textStyle").color || ""),
      };
    },
  });

  if (!editor) {
    return (
      <div className="rounded-lg border border-[#e4c69f] bg-[#fffaf3] px-3 py-8 text-center text-[13px] text-[#8a6c5b]">
        编辑器加载中…
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#e4c69f] bg-[#fffaf3]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#ead7c2] bg-[#fff2df] px-2 py-2">
        <button
          type="button"
          className={`${btnBase} ${toolbar?.bold ? btnActive : btnIdle}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          加粗
        </button>
        <button
          type="button"
          className={`${btnBase} ${toolbar?.bullet ? btnActive : btnIdle}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          无序列表
        </button>
        <button
          type="button"
          className={`${btnBase} ${toolbar?.ordered ? btnActive : btnIdle}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          有序列表
        </button>
        <label className="flex items-center gap-1.5 text-[12px] font-bold text-[#5a241a]">
          <span>颜色</span>
          <select
            className="rounded-md border border-[#e4c69f] bg-white px-2 py-1 text-[12px] font-normal"
            value={toolbar?.color || ""}
            onChange={(event) => {
              const next = event.target.value;
              if (!next) {
                editor.chain().focus().unsetColor().run();
                return;
              }
              editor.chain().focus().setColor(next).run();
            }}
          >
            {COLORS.map((item) => (
              <option key={item.label} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {toolbar?.color ? (
          <span
            className="inline-block h-4 w-4 rounded-full border border-[#d7b48a]"
            style={{ background: toolbar.color }}
            title={toolbar.color}
          />
        ) : null}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
