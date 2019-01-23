HTMLWidgets.widget({

  name: 'breadcrumb',

  type: 'output',

  factory: function(el, width, height) {

    var el = el;
    var svg = d3.select(el).append("svg").attr("width", width).attr("height", height);
    var breadcrumb = d3.breadcrumb().container(svg)

    breadcrumb.dispatch.on("mouseover", d => { Shiny.onInputChange(el.id + '_hover', d); });
    breadcrumb.dispatch.on("clicked", d => { Shiny.onInputChange(el.id + '_clicked', d); });

    return {

      renderValue: function(x) {
        for (var key in x.opts) {
          breadcrumb.attrs[key] = x.opts[key]
        }
        console.log(x.data);
        breadcrumb.show(x.data);

      },

      resize: function(width, height) {
        svg.attr("width", width).attr("height", height)
        breadcrumb.wrapWidth(width)
      }

    };
  }
});
