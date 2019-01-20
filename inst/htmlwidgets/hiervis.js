HTMLWidgets.widget({

  name: 'hiervis',

  type: 'output',

  factory: function(el, width, height) {

    var el = el;
    var svg = d3.select(el).append("svg").attr("width", width).attr("height", height);

    hiervisDispatch.on("mouseover", d => { Shiny.onInputChange(el.id + '_hover', d); });
    hiervisDispatch.on("clicked", d => { Shiny.onInputChange(el.id + '_clicked', d); });

    return {

      renderValue: function(x) {

        var chart = hiervis(svg, x.data, x.opts);
        chart.draw(x.vis)

      },

      resize: function(width, height) {
        svg.attr("width", width).attr("height", height)
      }

    };
  }
});
