

var build_boundary_url = function(boundary_datasetId, callback){

    var datasetId = $("#dataset_id").val();
    var excessUrl = 'https://q.nqminds.com/v1/datasets/' + datasetId + '/distinct?filter={"Contract":"Excess"}&key=HWRC';
    $.ajax(excessUrl).done(function(res){

        //build the boundary url
        var boundaryUrl = 'https://q.nqminds.com/v1/datasets/' + boundary_datasetId + '/data?filter={"$or":[';
        for(var i = 0; i < res.data.length; i++){
            boundaryUrl += '{"properties.LAD14CD":"' +  res.data[i].slice(-9) + '"},'
        }
        boundaryUrl = boundaryUrl.slice(0,-1);
        boundaryUrl += ']}';

        callback(boundaryUrl)
    })

};



var get_district_data = function(callback){


    var sid = $("#sid_map_select").val();
    var nid = $("#nid_map_select").val();

    //if(sid == null){sid = "2015"}
    //if(nid == null){nid = "11111111111111111111111111"}

    if(sid == null || nid == null){
        callback([])
    } else {

        var datasetId = $("#dataset_id").val();

        //var unit = $("input[name='map_data_group']:checked").val();
        var unit = "Cost";

        var district_data_url = 'https://q.nqminds.com/v1/datasets/'
            + datasetId
            + '/aggregate?pipeline=[{"$match":{"$and":[{"Contract":"Excess"},{"SID":"'
            + sid
            + '"},{"NID":"'
            + nid
            + '"}]}},{"$group":{"_id":{"HWRC":"$HWRC"},"Value":{"$sum":"$'
            + unit
            + '"}}}]';

        var district_rank_url = 'https://q.nqminds.com/v1/datasets/'
            + datasetId
            + '/aggregate?pipeline=[{"$match":{"$and":[{"Contract":"Excess"},{"SID":"'
            + sid
            + '"}]}},{"$group":{"_id":{"HWRC":"$HWRC","NID":"$NID"},"Values":{"$sum":"$'
            + unit
            + '"}}},{"$group":{"_id":"null","All_Values":{"$push":"$Values"}}}]';


        $.ajax(district_data_url).done(function (res) {

            var values = res.data;

            $.ajax(district_rank_url).done(function (res) {

                var ranks = res.data[0].All_Values.sort(function(a,b){return a - b});



                //remove 0s from ranks array
                while (ranks[0] == 0) {
                    ranks.shift();
                }

                var ranks_count = ranks.length;

                var data = [];
                for (var value_index = 0; value_index < values.length; value_index++) {

                    var entity = values[value_index]._id.HWRC.slice(-9);
                    var value = values[value_index].Value;

                    if (value == 0) {
                        data.push({id: entity, val: 0});
                    } else {
                        //data.push({id: entity, val: (ranks.indexOf(value) + 1) / ranks_count});
                        data.push({id: entity, val: value});
                    }
                }

                callback(data, ranks);

            })
        })
    }

};


var get_nid_data = function(callback){

    var sid = $("#sid_map_select").val();
    var nid = $("#nid_map_select").val();

    //if(sid == null){sid = "2015"}
    //if(nid == null){nid = "11111111111111111111111111"}

    if(sid == null || nid == null){
        callback([])
    } else {

        var datasetId = $("#dataset_id").val();

        //var unit = $("input[name='map_data_group']:checked").val();
        var unit = "Cost";

        var total_cost_url = 'https://q.nqminds.com/v1/datasets/'
            + datasetId
            + '/aggregate?pipeline=[{"$match":{"$and":[{"SID":"'
            + sid
            + '"},{"NID":"'
            + nid
            + '"}]}},{"$group":{"_id":null,"Total_Cost":{"$sum":"$'
            + unit
            + '"}}}]';

        var cost_rank_url = 'https://q.nqminds.com/v1/datasets/'
            + datasetId
            + '/aggregate?pipeline=[{"$match":{"$and":[{"SID":"'
            + sid
            + '"}]}},{"$group":{"_id":{"NID":"$NID"},"Values":{"$sum":"$'
            + unit
            + '"}}},{"$group":{"_id":"null","All_Values":{"$push":"$Values"}}}]';


        $.ajax(total_cost_url).done(function (res) {

            var total_cost = res.data[0].Total_Cost;

            console.log(total_cost)

            $.ajax(cost_rank_url).done(function (res) {

                var ranks = res.data[0].All_Values.sort(function(a,b){return a - b});

                var rank = ranks.indexOf(total_cost);
                var ranks_count = ranks.length;

                callback(total_cost, rank, ranks_count);

            })
        })
    }

};

//var get_hwrc_data = function(callback){
//
//    var sid = $("#sid_map_select").val();
//    var nid = $("#nid_map_select").val();
//
//    //if(sid == null){sid = "2015"}
//    //if(nid == null){nid = "11111111111111111111111111"}
//
//    if(sid == null || nid == null){
//        callback([])
//    } else {
//
//        var datasetId = $("#dataset_id").val();
//
//        var unit = $("input[name='map_data_group']:checked").val();
//
//        var data_url = 'https://q.nqminds.com/v1/datasets/'
//            + datasetId
//            + '/aggregate?pipeline=[{"$match":{"$and":[{"Contract":{"$ne":"Excess"}},{"SID":"'
//            + sid
//            + '"},{"NID":"'
//            + nid
//            + '"}]}},{"$group":{"_id":{"HWRC":"$HWRC"},"Value":{"$sum":"$'
//            + unit
//            + '"}}}]';
//
//        //console.log(data_url)
//
//        $.ajax(data_url).done(function (res) {
//
//            var values = res.data;
//            var data = [];
//            for (var value_index = 0; value_index < values.length; value_index++) {
//
//                var entity = values[value_index]._id.HWRC;
//                var value = values[value_index].Value;
//                data.push({id: entity, val: value});
//
//            }
//
//            callback(data);
//
//        })
//    }
//};
var get_hwrc_data = function(callback){

    var sid = $("#sid_map_select").val();
    var nid = $("#nid_map_select").val();

    //if(sid == null){sid = "2015"}
    //if(nid == null){nid = "11111111111111111111111111"}

    if(sid == null || nid == null){
        callback([])
    } else {

        var datasetId = $("#dataset_id").val();

        //var unit = $("input[name='map_data_group']:checked").val();
        var unit = "Cost"

        var data_url = 'https://q.nqminds.com/v1/datasets/'
            + datasetId
            + '/aggregate?pipeline=[{"$match":{"$and":[{"Contract":{"$ne":"Excess"}},{"SID":"'
            + sid
            + '"},{"NID":"'
            + nid
            + '"}]}},{"$group":{"_id":{"HWRC":"$HWRC"},"Value":{"$sum":"$'
            + unit
            + '"}}}]';

        var max_url = 'https://q.nqminds.com/v1/datasets/'
            + datasetId
            + '/aggregate?pipeline=[{"$match":{"$and":[{"Contract":{"$ne":"Excess"}},{"SID":"'
            + sid
            + '"}]}},{"$group":{"_id":null,"Max":{"$max":"$'
            + unit
            + '"}}}]';

        //console.log(data_url)
        //console.log(max_url)


        $.ajax(data_url).done(function (res) {

            var values = res.data;

            $.ajax(max_url).done(function (res) {

                var max = res.data[0].Max;


                var data = [];
                for (var value_index = 0; value_index < values.length; value_index++) {

                    var entity = values[value_index]._id.HWRC;
                    var value = values[value_index].Value;
                    data.push({id: entity, val: value});

                }


                callback(data, max);

            })
        })
    }
};




var call_wasteMap = function(data){

    var datasetId = $("#dataset_id").val();

    wasteMap = new WasteMap("wasteMap1", "#mapContainer", data)

};



window.onload = function() {


    var check_list = [
        {variable: "boundaryUrl", check: false},
        {variable: "districtData", check: false},
        {variable: "poiUrl", check: false},
        {variable: "poiData", check: false},
        {variable: "hwrcLookupUrl", check: false}
    ];

    var checkList_wasteMap = new CheckList(check_list, call_wasteMap);



    var boundary_datasetId = "SylXzM7_N";
    build_boundary_url(boundary_datasetId, function(res){
        checkList_wasteMap._check("boundaryUrl", res)
    });

    get_district_data(function(res){
        checkList_wasteMap._check("districtData", res)
    });

    var poi_datasetId = "SJlymEnf4";
    checkList_wasteMap._check("poiUrl", "https://q.nqminds.com/v1/datasets/" + poi_datasetId + "/data")


    get_hwrc_data(function(res){
        checkList_wasteMap._check("poiData", res)
    });

    var hwrcLookup_datasetId = "S1lWjFHVV";
    checkList_wasteMap._check("hwrcLookupUrl", "https://q.nqminds.com/v1/datasets/" + hwrcLookup_datasetId + "/data")

};