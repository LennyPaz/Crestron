// Crestron label markup -> HTML. The panel stores labels as escaped markup:
//   <P align="center"><FONT size="18" face="Arial" color="#101820"><B>TXT</B></FONT></P>
// plus <BR> and <cips>N?</cips>, which is an inline serial-join reference: the
// glass splices the live text of serial join N at that point. We convert to
// spans and leave <span data-cips="N"> for the renderer to bind.
"use strict";

function crestronLabelToHtml(markup) {
  if (!markup) return "";
  let s = markup;
  // inline serial joins first, before tag conversion
  s = s.replace(/<cips>(\d+)\?<\/cips>/g, '<span data-cips="$1"></span>');
  s = s.replace(/<P\s+align="?(\w+)"?\s*>/gi, '<div style="text-align:$1">');
  s = s.replace(/<P>/gi, "<div>");
  s = s.replace(/<\/P>/gi, "</div>");
  s = s.replace(/<FONT([^>]*)>/gi, (m, attrs) => {
    let css = "";
    const size = /size="(\d+)"/i.exec(attrs);
    const color = /color="(#?\w+)"/i.exec(attrs);
    const face = /face="([^"]+)"/i.exec(attrs);
    if (size) css += "font-size:" + size[1] + "px;";
    if (color) css += "color:" + (color[1][0] === "#" ? color[1] : "#" + color[1]) + ";";
    if (face) css += "font-family:'" + face[1] + "',Arial,sans-serif;";
    return '<span style="' + css + '">';
  });
  s = s.replace(/<\/FONT>/gi, "</span>");
  s = s.replace(/<B>/gi, '<span style="font-weight:bold">');
  s = s.replace(/<\/B>/gi, "</span>");
  s = s.replace(/<BR>/gi, "<br>");
  return s;
}

// Dynamic serial text sent by the program uses the same markup dialect
// (Page1Formatter emits <FONT size=".."><B>..</B></FONT><BR>..).
window.crestronLabelToHtml = crestronLabelToHtml;
