/**
 * Created by leovalberg on 06/06/2016.
 */

var CheckList = function(check_list, done_function){
    this.check_list = check_list;
    this.data = {};
    this.done_function = done_function;
};



CheckList.prototype._check = function(variable, res){

    var flag = true;
    for(var i = 0; i < this.check_list.length; i++){


        if(this.check_list[i].variable == variable){

            this.check_list[i].check = true;
            this.data[variable] = res;
        }

        if(this.check_list[i].check == false){
            flag = false
        }

    }

    if(flag == true){
        this.done_function(this.data);
    }

};
