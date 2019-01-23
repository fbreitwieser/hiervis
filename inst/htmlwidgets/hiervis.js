HTMLWidgets.widget({

  name: 'hiervis',

  type: 'output',

  factory: function(el, width, height) {

    var el = el;
    var svg = d3.select(el).append("svg").attr("width", width).attr("height", height);
    var selected;

    return {

      renderValue: function(x) {
        var chart = hiervis(svg, x.data, x.opts);
        chart.dispatch.on("mouseover", d => { 
            Shiny.onInputChange(el.id + '_hover', JSON.stringify(d)); 
        });
        chart.dispatch.on("mouseout", d => { 
            Shiny.onInputChange(el.id + '_clicked', JSON.stringify(selected)); 
        });
        chart.dispatch.on("clicked", d => { 
            selected = d;
            Shiny.onInputChange(el.id + '_clicked', JSON.stringify((d))); 
        });

        // this message handler currently does not work - requires refactoring
        //  of hiervis.js module
        Shiny.addCustomMessageHandler(el.id + "_goUp", n => { chart.goUp(n) })

        chart.draw(x.vis)

      },

      resize: function(width, height) {
        svg.attr("width", width).attr("height", height)
      }

    };
  }
});
