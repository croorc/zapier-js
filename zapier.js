'use strict';

var Zap = {
    // Make sure this is an api URI, change it back to 'https://api.sparkhire.com' before deploying to the main application
    api_base_uri : 'https://api.example.com',

    set_base_uri: function(url) {
        var matches = url.match(/(^https?\:\/\/)([^\/?#]+)(?:[\/?#])(.*)$/i);
        return this.api_base_uri +'/'+ matches[3];
    },

    auth_post_poll: function(bundle) {
        var result = z.JSON.parse(bundle.response.content);
        if (bundle.response.status_code==401||bundle.response.status_code==400) {
            if (typeof result.reason !== 'undefined')
                throw new ErrorException(result.reason);
            else
                throw new ErrorException("Your API Key does not appear to be valid.");
        }
        return result;
    },

    poll_questions_pre_poll: function(bundle) {
        bundle.request.url = this.set_base_uri(bundle.request.url);
        return bundle.request;
    },

    auth_pre_poll: function(bundle) {
        bundle.request.url = this.set_base_uri(bundle.request.url);
        return bundle.request;
    },

    poll_jobs_pre_poll: function(bundle) {
        bundle.request.url = this.set_base_uri(bundle.request.url);
        return bundle.request;
    },

    interview_completed_pre_poll: function(bundle) {
        bundle.request.url = this.set_base_uri(bundle.request.url);

        if (typeof bundle.trigger_fields.jobs != 'undefined') {
            var params = Object.assign({}, bundle.request.params, {'job[uuid]':bundle.trigger_fields.jobs.join(',')});
            bundle.request.params = params;
        }
        return bundle.request;
    },

    interview_created_pre_poll: function(bundle) {
        bundle.request.url = this.set_base_uri(bundle.request.url);

        if (typeof bundle.trigger_fields.jobs != 'undefined') {
            var params = Object.assign({}, bundle.request.params, {'job[uuid]':bundle.trigger_fields.jobs.join(',')});
            bundle.request.params = params;
        }
        return bundle.request;
    },

    poll_dates_poll: function(bundle) {
        var options=[];
        for(var i=1;i<=30;i++) {
            var days= i > 1 ? i+' days' : i+' day';
            options.push({raw:days+' from now',label:days+' from now'});
        }
        return options;
    },

    create_interview_pre_write: function(bundle) {
        var data = z.JSON.parse(bundle.request.data);
        var dataWithFields = Object.assign({}, data, {type:'one_way'});
        bundle.request.data = JSON.stringify(dataWithFields);
        bundle.request.url = this.set_base_uri(bundle.request.url);
        return bundle.request;
    },

    pre_subscribe: function(bundle) {
        if (Object.keys(bundle.trigger_fields).length) {
          var data = z.JSON.parse(bundle.request.data);
          // Add trigger fields to subscribe webhook
          var dataWithFields = Object.assign({}, data, bundle.trigger_fields);
          bundle.request.data = JSON.stringify(dataWithFields);
        }
        // Change URL subdomain
        bundle.request.url = this.set_base_uri(bundle.request.url);
        return bundle.request;
    },

    pre_unsubscribe: function(bundle) {
        bundle.request.url = this.set_base_uri(bundle.request.url);
        return bundle.request;
    },

    interview_created_catch_hook: function(bundle) {
        var result = z.JSON.parse(bundle.request.content);
        result=this.modify_interview_fields(result);
        result= _.omit(result, ["basic_share_link","watch_interview_link","completed_at"]);
        return result;
    },

    interview_created_post_poll: function(bundle) {
        var results = z.JSON.parse(bundle.response.content);
        var self=this;
        if (results.length===0) {
            results=[];
        }
        else {
            results.forEach(function(result, index, array){
              result=self.modify_interview_fields(result);
              result= _.omit(result, ["basic_share_link","watch_interview_link","completed_at"]);
              results[index]=result;
            });
        }
        return results;
    },

    interview_completed_catch_hook: function(bundle) {
        var result = z.JSON.parse(bundle.request.content);
        result=this.modify_interview_fields(result);
        return result;
    },

    interview_completed_post_poll: function(bundle) {
        var results = z.JSON.parse(bundle.response.content);
        var self=this;
        if (results.length===0) {
            results=[];
        }
        else {
            results.forEach(function(result, index, array){
              result=self.modify_interview_fields(result);
              results[index]=result;
            });
        }
        return results;
    },

    modify_interview_fields: function(result) {
        result = _.omit(result,['rating','rejection','questions']);
        result.watch_interview_link = "https://www.example.com/company/interviews/" + result.uuid  + "/watch";
        // Dehydrate basic_share_link if set
        if (typeof result.create_share_link !== 'undefined' && result.create_share_link==1)
            result.basic_share_link = z.dehydrate('get_share_link', {interview_uuid: result.uuid});
        else
            result.basic_share_link ='';

        // Remove other share link attributes if present
        result = _.omit(result,['share_link','create_share_link']);
        // Modify type and status attibutes
        result.type = this.uc_words(result.type.replace('_',' '));
        result.status = this.uc_words(result.status.replace('_',' '));
        // Select attributes using _.pick 
        result.job_post = _.pick(result.job_post, "title","location");
        result.job_post.location = _.pick(result.job_post.location, "formatted_address");
        result.company = _.pick(result.company, ["name","avatar"]);
        result.assigned_to = _.pick(result.assigned_to, ["name","first_name","last_name","avatar","email"]);
        result.created_by = _.pick(result.created_by, ["name","first_name","last_name","avatar","email"]);
        if (typeof result.assigned_to.first_name == 'undefined')
            result.assigned_to.first_name = this.get_first_name(result.assigned_to.name);
        if (typeof result.assigned_to.last_name == 'undefined')
            result.assigned_to.last_name = this.get_last_name(result.assigned_to.name);
        if (typeof result.created_by.first_name == 'undefined')
            result.created_by.first_name = this.get_first_name(result.created_by.name);
        if (typeof result.created_by.last_name == 'undefined')
            result.created_by.last_name = this.get_last_name(result.created_by.name);
        return result;
    },

    get_share_link: function(bundle) {
        var url = 'https://api-develop-new-feature.example.com/v1.0/interviews/' + bundle.interview_uuid + '/share_link';
        url = this.set_base_uri(url);
        var share_link = z.JSON.parse(z.request({
            method: 'POST',
            url: url,
            auth: [bundle.auth_fields.api_key, ''],
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json' 
            }
        }).content) || {url:''};
        return share_link.url;
    },

    uc_words:function (string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    },

    get_first_name: function(full_name) {
        return full_name.split(' ').slice(0, -1).join(' ');
    },

    get_last_name: function(full_name) {
        return full_name.split(' ').slice(-1).join(' ');
    }
};


/* // Sample data for testing only due to Zapier style guide
            [{
                "status": "Completed",
                "job_post": {
                    "location": {
                        "formatted_address": "Sample City, IL, USA"
                    },
                    "title": "Sample Job"
                },
                "watch_interview_link": "https://www.example.com/company/interviews/00000000-0000-0000-0000-000000000000/watch",
                "company": {
                    "name": "Sample Company"
                },
                "created_by": {
                    "email": "sample@sparkhire.com",
                    "avatar": "http://example.local/img/defaults/user.png",
                    "name": "Jane Doe"
                },
                "completed_at": "2017-05-23T23:00:00+00:00",
                "assigned_to": {
                    "email": "sample@sparkhire.com",
                    "avatar": "http://example.local/img/defaults/user.png",
                    "name": "John Doe"
                },
                "type": "One way",
                "scheduled_at": "2017-05-22T23:00:00+00:00"
            }]*/
